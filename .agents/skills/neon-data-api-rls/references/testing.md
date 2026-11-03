# Testing RLS policies

Test every policy change before it reaches production. Run the tests on a Neon branch, never on the production branch.

## 1. Create test users

Create five users on the test branch: sign them up through the app, add them in the Console (**Auth** → **Users**), or call the Neon MCP `create_auth_user` tool. Then read their ids:

```sql
select id, email from neon_auth.user order by email;
```

## 2. Run the persona test

Paste the ids at the top and run the whole block as the project owner role (Neon MCP `run_sql_transaction`, the SQL Editor, or `psql`). It gives the users roles and reporting lines, checks what each person can see and change, and then removes everything it created. If a check fails, it raises an error that names the person and the rule, and Postgres rolls the block back.

The org chart it builds: `lead` reports to `manager`, and `engineer` reports to `lead`. Only `manager` has the manager role, which proves that reporting lines alone grant nothing.

```sql
-- Persona test: what each kind of user can see and change.
do $$
declare
  admin_id    constant uuid := '00000000-0000-4000-8000-000000000001';
  manager_id  constant uuid := '00000000-0000-4000-8000-000000000002';
  lead_id     constant uuid := '00000000-0000-4000-8000-000000000003';
  engineer_id constant uuid := '00000000-0000-4000-8000-000000000004';
  outsider_id constant uuid := '00000000-0000-4000-8000-000000000005';
  everyone    constant uuid[] := array[admin_id, manager_id, lead_id, engineer_id, outsider_id];
  person record;
  seen bigint;
  engineer_product bigint;
begin
  -- Arrange, as the owner role (RLS does not apply to it).
  insert into app_private.user_roles (user_id, role)
  values (admin_id, 'admin'), (manager_id, 'manager');
  insert into app_private.reporting_lines (employee_id, manager_id)
  values (lead_id, manager_id), (engineer_id, lead_id);
  insert into public.products (owner_id, name)
  select unnest(everyone), 'persona test';
  select id into engineer_product from public.products
  where owner_id = engineer_id and name = 'persona test';

  -- Who sees what.
  for person in
    select * from (values
      (admin_id, 'admin', 5),
      (manager_id, 'manager', 3),
      (lead_id, 'lead', 1),
      (engineer_id, 'engineer', 1),
      (outsider_id, 'outsider', 1)
    ) as expected (user_id, label, visible)
  loop
    perform set_config('request.jwt.claims',
      json_build_object('sub', person.user_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into seen from public.products where owner_id = any (everyone);
    if seen <> person.visible then
      raise exception '% sees % products, expected %', person.label, seen, person.visible;
    end if;
    select count(*) into seen from public.profiles where id = any (everyone);
    if seen <> person.visible then
      raise exception '% sees % profiles, expected %', person.label, seen, person.visible;
    end if;
    reset role;
  end loop;

  -- The engineer can't create rows for someone else, or hand their own row away.
  perform set_config('request.jwt.claims',
    json_build_object('sub', engineer_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.products (owner_id, name) values (outsider_id, 'persona test');
    raise exception 'engineer created a product for someone else';
  exception when insufficient_privilege then null;
  end;
  begin
    -- No WHERE on purpose: with one, Postgres also checks the new row against the select
    -- policy, which would hide a too-loose WITH CHECK. RLS still limits this to the
    -- engineer's own rows.
    update public.products set owner_id = outsider_id;
    raise exception 'engineer gave their product to someone else';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from app_private.user_roles;
    raise exception 'engineer read the private roles table';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- The manager can see the engineer's product but not change it.
  perform set_config('request.jwt.claims',
    json_build_object('sub', manager_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.products set name = 'changed by manager' where id = engineer_product;
  get diagnostics seen = row_count;
  if seen <> 0 then
    raise exception 'manager changed a product they only manage';
  end if;
  reset role;

  -- The admin can change anyone's product.
  perform set_config('request.jwt.claims',
    json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.products set name = 'persona test' where id = engineer_product;
  get diagnostics seen = row_count;
  if seen <> 1 then
    raise exception 'admin could not change another user''s product';
  end if;
  reset role;

  -- Visitors who are not signed in get nothing.
  perform set_config('request.jwt.claims', '', true);
  set local role anonymous;
  begin
    perform 1 from public.products;
    raise exception 'an anonymous visitor read products';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- Clean up only what this test created.
  delete from public.products where owner_id = any (everyone) and name = 'persona test';
  delete from app_private.reporting_lines where employee_id in (lead_id, engineer_id);
  delete from app_private.user_roles where user_id in (admin_id, manager_id);
  raise notice 'All persona checks passed.';
end $$;
```

When you add a table or a rule, add its checks to this block.

On Neon, the project owner role (`neondb_owner`) may switch to `authenticated` and `anonymous`, so the block runs as is. A role created with plain SQL may not: if `set local role authenticated` fails with "permission denied to set role", run the block as the owner role, or test through the Data API (section 4).

## 3. Run the Data API advisors

Open **Monitoring** → **Data API Advisors** for the branch in the Neon Console, or call the Neon API: `GET /projects/{project_id}/advisors?branch_id={branch_id}`. Fix every `ERROR` and `WARN` before merging. The checks that matter most here:

- RLS disabled on an exposed table
- Policies that read `neon_auth.user.role` or organization metadata
- Views without `security_invoker`, and views or materialized views over `neon_auth.user`
- Functions without a fixed `search_path`
- Auth function calls not wrapped in `(select ...)`

## 4. Smoke-test through the app

Sign in as two different users in two browsers and confirm each sees only what the persona test promised. Then sign out and confirm the app shows nothing private.

What the Data API returns, as observed on Neon:

| Request                                                                                    | Response                                                     |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| No token                                                                                   | `400`, "missing authentication credentials"                  |
| Forged or tampered token                                                                   | `400`, "signature error"                                     |
| Signed-out visitor with Neon Auth's anonymous token, on a table without `anonymous` grants | `403`, code `42501`                                          |
| A write that a policy's `with check` rejects                                               | `403`, code `42501`                                          |
| An update or delete aimed at rows the user can't see                                       | `200` with no rows                                           |
| A table outside the exposed schemas, including `app_private` and `neon_auth`               | `404`, code `PGRST205`; `Accept-Profile` does not reach them |
| A `security definer` function in `app_private`                                             | `404`; only functions in exposed schemas are RPC endpoints   |
