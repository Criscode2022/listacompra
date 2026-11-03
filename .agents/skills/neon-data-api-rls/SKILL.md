---
name: neon-data-api-rls
description: >-
  Secure the Neon Data API with Neon Auth and Postgres Row-Level Security (RLS) so
  each signed-in user reaches only the rows they may see and change. Use when an
  Angular app reads or writes Neon tables from the browser; when adding per-user
  data ("users only see their own products"), admin access to everything, or
  manager and employee hierarchies; when writing, reviewing, or testing RLS
  policies, GRANTs, or role tables on Neon; and when wiring @neondatabase/auth or
  @neondatabase/postgrest-js into Angular. Load neon-auth for the login flow itself.
---

# Neon Data API with RLS

The browser queries the Neon Data API directly. Each request carries the signed-in user's Neon Auth token, the Data API runs the query as the Postgres role `authenticated`, and Row-Level Security decides which rows that user may read or change. **The database policies are the only security boundary.** Anything the client checks is a convenience.

Neon's own skills steer new apps toward a server (Neon Functions), because RLS that faces the browser is easy to get wrong. This project chose the Data API on purpose, so follow every rule below. When a requirement can't be expressed as a policy (payments, emails, third-party APIs, multi-step writes that must succeed together), put that part behind a Neon Function or your own server instead.

## Rules

1. **Create and protect a table in the same migration.** Create it, revoke the default grants, grant exactly what the app needs, enable RLS, and add its policies, all in one migration. The Data API's default grants cover every new table in `public`, so an unprotected table is exposed the moment it exists.
2. **Identify the user only with `(select auth.uid())`.** It reads the token's `sub` claim as a `uuid`, matching `neon_auth.user.id`. The `select` makes Postgres evaluate it once per query instead of once per row. Neon Auth's anonymous token has `sub` set to `"anonymous"`, which `auth.uid()` turns into `NULL`, so owner checks fail closed. Never compare `auth.user_id()` (text) with a text owner column.
3. **Keep app roles and reporting lines in `app_private`,** a schema the Data API does not expose and users cannot write. Never base a policy on `neon_auth.user.role` or `neon_auth.organization.metadata`: users can change them.
4. **Write helpers as `security definer` functions in `app_private`,** with `set search_path = ''` and every name schema-qualified.
5. **Keep every `update` policy's `with check` at least as strict as its `using`** (leaving `with check` out reuses `using`). A looser `with check` lets users hand rows to someone else.
6. **Write one permissive policy per table and command,** joining the owner, admin, and manager rules with `or`.
7. **Grant nothing to `anonymous`** unless the data is truly public, and then only `select`.
8. **Never expose `neon_auth`.** Keep the user fields the app needs in `public.profiles`. Create views with `with (security_invoker = on)`, and keep materialized views out of exposed schemas.
9. **Index every column a policy filters on.**
10. **After each migration,** refresh the Data API schema cache, run the persona test, and clear every Data API Advisors finding.

## Access patterns

Start from owner-only and add a clause for each role the app has. The full migration is in [references/rls-patterns.md](references/rls-patterns.md).

| The app needs                                              | Policy clause                                            |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| Users see and change only their own rows                   | `owner_id = (select auth.uid())`                         |
| Admins see and change everything                           | `or (select app_private.has_role('admin'))`              |
| Managers see the people under them and those people's rows | `or owner_id in (select app_private.managed_user_ids())` |

## Workflow

1. **Branch.** Work on a Neon branch, never on production (Neon MCP `create_branch`).
2. **Enable Neon Auth and the Data API on that branch** if they're off: Neon MCP `provision_neon_auth` with `auth_provider: "better_auth"`, then `provision_neon_data_api` with `auth_provider: "neon_auth"`. Or use the Console's Data API page with **Use Managed Better Auth** checked. Leave **Exposed schemas** at `public`.
3. **Write the migration** from [references/rls-patterns.md](references/rls-patterns.md), keeping only the patterns the app needs.
4. **Apply it to the branch,** then refresh the schema cache (Console button, or the Neon MCP `update_data_api` tool).
5. **Test** with the persona test in [references/testing.md](references/testing.md), then run Data API Advisors. Fix everything they report.
6. **Ship the migration** with `prepare_database_migration` and `complete_database_migration` once the user approves.
7. **Connect Angular** with [references/angular.md](references/angular.md).
8. **Before production:** set CORS allowed origins to your domains (`server_cors_allowed_origins`; empty allows every origin), set a maximum number of rows per request (`db_max_rows`), add your production domains to Neon Auth's trusted domains, and set up custom SMTP for auth emails (https://neon.com/docs/auth/production-checklist.md).

## References

- [references/rls-patterns.md](references/rls-patterns.md): roles, reporting lines, helpers, profiles, grants, and policies in one migration, with variations and admin-only functions.
- [references/testing.md](references/testing.md): a persona test that proves who sees and changes what, plus Data API Advisors.
- [references/angular.md](references/angular.md): Neon Auth and the Data API in Angular: endpoints, types, a lazily loaded client, session signals, a guard, and data services.
- Neon docs: [Data API access control](https://neon.com/docs/data-api/access-control.md), [Data API Advisors](https://neon.com/docs/data-api/database-advisor.md), [Managed Better Auth](https://neon.com/docs/auth/overview.md), [JavaScript SDK](https://neon.com/docs/reference/javascript-sdk.md). Docs index: https://neon.com/docs/llms.txt. Add `.md` to any docs URL to get markdown.
