# RLS patterns for the Neon Data API

One migration covers all three access patterns. Adapt it to your tables, then delete the clauses you don't need (see [Choose your patterns](#choose-your-patterns)).

The example uses `public.products`. Every product belongs to the user who created it.

| Person             | Sees                                                            | Changes                        |
| ------------------ | --------------------------------------------------------------- | ------------------------------ |
| Any signed-in user | Their own products and profile                                  | Their own products and profile |
| Admin              | Everything                                                      | Everything                     |
| Manager            | Their own data, plus everyone below them in the reporting lines | Only their own data            |

## The migration

Run it as one transaction on a branch, as the project owner role, after Neon Auth and the Data API are enabled. Enabling the Data API creates the `authenticated` and `anonymous` roles this migration grants to.

Checked on Neon on 2026-10-03 (Postgres 18.6, `pg_session_jwt` 0.5.0, Data API default grants on). The migration and the optional functions apply as written, including the foreign keys to `neon_auth.user` and the sign-up trigger, which created a profile for every user who signed up through Neon Auth.

```sql
-- Migration: owner, admin, and manager access to products through the Data API.

-- 1. A private schema the Data API does not expose. API users may call its functions and
--    use its types, nothing else.
create schema app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

-- 2. Roles that grant extra access. Ordinary users have no row here. Only the owner role,
--    or the admin-only functions below, can write this table.
create type app_private.app_role as enum ('admin', 'manager');

create table app_private.user_roles (
  user_id uuid not null references neon_auth.user (id) on delete cascade,
  role app_private.app_role not null,
  primary key (user_id, role)
);

-- 3. Reporting lines. Each employee has at most one manager.
create table app_private.reporting_lines (
  employee_id uuid primary key references neon_auth.user (id) on delete cascade,
  manager_id uuid not null references neon_auth.user (id) on delete cascade,
  constraint reporting_lines_not_self check (employee_id <> manager_id)
);
create index reporting_lines_manager_id_idx on app_private.reporting_lines (manager_id);

-- 4. Helpers that policies call. SECURITY DEFINER lets them read the private tables;
--    the empty search_path stops anyone from swapping in look-alike objects.
create function app_private.has_role(wanted app_private.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app_private.user_roles
    where user_id = (select auth.uid()) and role = wanted
  );
$$;

-- Everyone below the caller in the reporting lines, at any depth, if the caller is a
-- manager. UNION (not UNION ALL) stops the recursion if the lines ever form a loop.
create function app_private.managed_user_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  with recursive team (user_id) as (
    select employee_id
    from app_private.reporting_lines
    where manager_id = (select auth.uid())
    union
    select line.employee_id
    from app_private.reporting_lines as line
    join team on line.manager_id = team.user_id
  )
  select user_id
  from team
  where (select app_private.has_role('manager'));
$$;

revoke all on function app_private.has_role(app_private.app_role) from public;
revoke all on function app_private.managed_user_ids() from public;
grant execute on function app_private.has_role(app_private.app_role) to authenticated;
grant execute on function app_private.managed_user_ids() to authenticated;

-- 5. One public profile per user, created at sign-up. The app reads this table, never
--    neon_auth.user.
create table public.profiles (
  id uuid primary key references neon_auth.user (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create function app_private.create_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.name, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function app_private.create_profile() from public;

create trigger create_profile_after_sign_up
  after insert on neon_auth.user
  for each row execute function app_private.create_profile();

-- Users who signed up before this migration.
insert into public.profiles (id, display_name)
select id, coalesce(name, '')
from neon_auth.user
on conflict (id) do nothing;

-- 6. The data. A new row belongs to whoever creates it.
create table public.products (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references neon_auth.user (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index products_owner_id_idx on public.products (owner_id);

-- 7. Exact privileges, whatever the Data API's default grants did.
revoke all on public.profiles, public.products from authenticated, anonymous;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.products to authenticated;

-- 8. Row-Level Security. One policy per command. Each clause is one access pattern.
alter table public.profiles enable row level security;
alter table public.products enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())                          -- owner
    or (select app_private.has_role('admin'))         -- admin
    or id in (select app_private.managed_user_ids())  -- manager
  );

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select app_private.has_role('admin')))
  with check (id = (select auth.uid()) or (select app_private.has_role('admin')));

create policy products_select on public.products
  for select to authenticated
  using (
    owner_id = (select auth.uid())                          -- owner
    or (select app_private.has_role('admin'))               -- admin
    or owner_id in (select app_private.managed_user_ids())  -- manager
  );

create policy products_insert on public.products
  for insert to authenticated
  with check (owner_id = (select auth.uid()) or (select app_private.has_role('admin')));

create policy products_update on public.products
  for update to authenticated
  using (owner_id = (select auth.uid()) or (select app_private.has_role('admin')))
  with check (owner_id = (select auth.uid()) or (select app_private.has_role('admin')));

create policy products_delete on public.products
  for delete to authenticated
  using (owner_id = (select auth.uid()) or (select app_private.has_role('admin')));
```

After the migration, refresh the Data API schema cache: click **Refresh schema cache** on the Data API page, or call the Neon MCP `update_data_api` tool.

## Choose your patterns

| The app has                                    | Keep                                           | Delete                                                  |
| ---------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------- |
| Only users who own their data                  | Sections 5 to 8, and the owner clauses         | Sections 1 to 4, and every admin and manager clause     |
| Users and admins                               | Sections 1, 2, 4 (`has_role` only), and 5 to 8 | Section 3, `managed_user_ids`, and every manager clause |
| Managers and employees, with or without admins | Everything                                     | Nothing (drop the admin clauses if there are no admins) |

When you delete a clause, keep the policy itself: an owner-only `products_select` is `using (owner_id = (select auth.uid()))`.

## Variations

- **Managers can also edit their team's rows:** add `or owner_id in (select app_private.managed_user_ids())` to both the `using` and the `with check` of `products_update` (and `products_delete` if they may delete).
- **Direct reports only:** replace the body of `managed_user_ids` with:

  ```sql
  select employee_id
  from app_private.reporting_lines
  where manager_id = (select auth.uid()) and (select app_private.has_role('manager'));
  ```

- **More tables:** give each table an `owner_id uuid not null default auth.uid()` column and an index on it, then copy steps 7 and 8. A child table with no owner of its own (order lines, comments) checks its parent: `using (exists (select 1 from public.products as p where p.id = product_id))`. That subquery runs under the parent's policies, so it only finds parents the user may see.
- **Data everyone signed in may read:** `for select to authenticated using (true)`. Never use `true` in an `insert`, `update`, or `delete` policy.

## Let admins manage roles from the app

Without this, roles and reporting lines change only through SQL run as the owner role. These functions live in `public`, so the Data API exposes them as RPC (`client.rpc('grant_role', { ... })`). Each checks that the caller is an admin before it touches anything.

```sql
-- Optional: admin-only role and reporting-line management over the Data API.

create function public.grant_role(target_user uuid, role_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app_private.has_role('admin') then
    raise exception 'Only admins can grant roles' using errcode = '42501';
  end if;
  insert into app_private.user_roles (user_id, role)
  values (target_user, role_name::app_private.app_role)
  on conflict do nothing;
end;
$$;

create function public.revoke_role(target_user uuid, role_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app_private.has_role('admin') then
    raise exception 'Only admins can revoke roles' using errcode = '42501';
  end if;
  delete from app_private.user_roles
  where user_id = target_user and role = role_name::app_private.app_role;
end;
$$;

create function public.set_manager(employee uuid, manager uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app_private.has_role('admin') then
    raise exception 'Only admins can change reporting lines' using errcode = '42501';
  end if;
  insert into app_private.reporting_lines (employee_id, manager_id)
  values (employee, manager)
  on conflict (employee_id) do update set manager_id = excluded.manager_id;
end;
$$;

revoke all on function public.grant_role(uuid, text) from public;
revoke all on function public.revoke_role(uuid, text) from public;
revoke all on function public.set_manager(uuid, uuid) from public;
grant execute on function public.grant_role(uuid, text) to authenticated;
grant execute on function public.revoke_role(uuid, text) to authenticated;
grant execute on function public.set_manager(uuid, uuid) to authenticated;
```

## Why it's built this way

- **Roles live in `app_private`, not in Neon Auth.** Users can edit `neon_auth.user.role`, so Neon's advisors flag any policy that reads it. The Neon Auth token can't carry custom claims either, so the database is the only trustworthy place for app roles.
- **`(select ...)` around every function call** turns it into one evaluation per query instead of one per row.
- **One policy per command, with `or` between clauses**, avoids Postgres evaluating several permissive policies for the same command.
- **Helpers return sets and booleans, not rows.** An API user can call `app_private.managed_user_ids()` but only ever learns their own team.
- **`neon_auth.user` stays private.** Expose `public.profiles`, with its own policies, instead of a view over the auth table.
