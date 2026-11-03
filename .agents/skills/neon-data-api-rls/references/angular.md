# Angular client for Neon Auth and the Data API

The browser signs in with Neon Auth and queries the Data API. The SDK attaches the user's short-lived token (15 minutes) to every query, and RLS does the rest.

Checked with Angular 22.2, `@neondatabase/auth` 0.5.0-beta, and `@neondatabase/postgrest-js` 0.2.0-beta. Both packages are beta: pin exact versions and re-check https://neon.com/docs/reference/javascript-sdk.md before upgrading.

## Install

```sh
npm install --save-exact @neondatabase/auth @neondatabase/postgrest-js
```

Neon's combined `@neondatabase/neon-js` package works too, but its main entry also loads React adapter code, which makes Angular builds warn about CommonJS dependencies. The two packages above give the same features without it.

## Endpoints

You need two URLs, both public: the **Auth URL** (Console, Auth page) and the **Data API URL** (Console, Data API page, or the Neon MCP `get_data_api` tool). Never put a Postgres connection string in Angular code. Run `ng generate environments` and keep each environment pointed at its own branch: development at a dev branch, production at the production branch.

```ts
// src/app/core/neon/neon-config.ts
import { InjectionToken } from '@angular/core';

/** Public Neon endpoints from the Console's Auth and Data API pages. Neither is a secret. */
export interface NeonEndpoints {
  /** For example https://ep-x.neonauth.c-2.us-east-2.aws.neon.tech/neondb/auth */
  readonly authUrl: string;
  /** For example https://ep-x.apirest.c-2.us-east-2.aws.neon.tech/neondb/rest/v1 */
  readonly dataApiUrl: string;
}

export const NEON_ENDPOINTS = new InjectionToken<NeonEndpoints>('NEON_ENDPOINTS');
```

Provide it in `src/app/app.config.ts`: `{ provide: NEON_ENDPOINTS, useValue: environment.neon }`.

## Database types

Generate types from the branch schema so queries are checked at compile time and nothing is typed `any`. The generator needs a direct connection string: read it from the environment (a gitignored `.env`), never from a committed file. The generated file holds types only and is safe to commit.

```sh
npx @neondatabase/neon-js gen-types --db-url "$DATABASE_URL" --output src/app/core/neon/database.types.ts
```

Run it again after every migration.

## The client

The SDK adds about 450 kB (about 90 kB compressed), which would push the initial bundle past the template's 500 kB budget. Load it with `import()` on first use instead.

```ts
// src/app/core/neon/neon-client.ts
import { inject, Service } from '@angular/core';
import type { Database } from './database.types';
import { NEON_ENDPOINTS } from './neon-config';

/**
 * Neon Auth plus typed Data API queries. Every query carries the signed-in user's token.
 * The SDK adds about 450 kB, so it loads on first use instead of in the initial bundle.
 */
@Service()
export class NeonClient {
  private readonly endpoints = inject(NEON_ENDPOINTS);
  private clients?: ReturnType<NeonClient['connect']>;

  async auth() {
    return (await this.loaded()).auth;
  }

  async db() {
    return (await this.loaded()).db;
  }

  private loaded() {
    this.clients ??= this.connect();
    return this.clients;
  }

  private async connect() {
    const [{ createAuthClient }, { fetchWithToken, NeonPostgrestClient }] = await Promise.all([
      import('@neondatabase/auth'),
      import('@neondatabase/postgrest-js'),
    ]);
    const auth = createAuthClient(this.endpoints.authUrl);
    const db = new NeonPostgrestClient<Database>({
      dataApiUrl: this.endpoints.dataApiUrl,
      options: {
        global: { fetch: fetchWithToken(async () => (await auth.token()).data?.token ?? null) },
      },
    });
    return { auth, db };
  }
}
```

## Session

```ts
// src/app/core/neon/auth-session.ts
import { computed, inject, Service, signal } from '@angular/core';
import { NeonClient } from './neon-client';

/** The signed-in user, as the app sees them. */
export interface SignedInUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}

/** Neon Auth session state as signals. */
@Service()
export class AuthSession {
  private readonly neon = inject(NeonClient);
  private readonly currentUser = signal<SignedInUser | null>(null);

  readonly user = this.currentUser.asReadonly();
  readonly isSignedIn = computed(() => this.currentUser() !== null);

  async load(): Promise<void> {
    const { data, error } = await (await this.neon.auth()).getSession();
    if (error) {
      throw new Error(`Could not read the session: ${error.message}`);
    }
    const user = data?.user;
    this.currentUser.set(user ? { id: user.id, email: user.email, name: user.name } : null);
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await (await this.neon.auth()).signIn.email({ email, password });
    if (error) {
      throw new Error(error.message ?? 'Sign-in failed.');
    }
    await this.load();
  }

  async signUp(name: string, email: string, password: string): Promise<void> {
    const { error } = await (await this.neon.auth()).signUp.email({ name, email, password });
    if (error) {
      throw new Error(error.message ?? 'Sign-up failed.');
    }
    await this.load();
  }

  async signOut(): Promise<void> {
    await (await this.neon.auth()).signOut();
    this.currentUser.set(null);
  }
}
```

Build the sign-in and sign-up pages with Signal Forms and call these methods. Social sign-in, email codes, and password reset are in the `neon-auth` skill and https://neon.com/docs/auth/overview.md.

## Guard

```ts
// src/app/core/neon/signed-in.guard.ts
import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthSession } from './auth-session';

/** Sends signed-out visitors to the sign-in page. A convenience: RLS is the protection. */
export const signedInGuard: CanActivateFn = async () => {
  const session = inject(AuthSession);
  if (!session.isSignedIn()) {
    await session.load();
  }
  return session.isSignedIn() || inject(Router).createUrlTree(['/sign-in']);
};
```

## Data access

One service per table, behind the feature's repository boundary. Select the columns you show, not `*`.

```ts
// src/app/features/products/products-data.ts
import { inject, Service } from '@angular/core';
import type { Tables } from '../../core/neon/database.types';
import { NeonClient } from '../../core/neon/neon-client';

export type Product = Tables<'products'>;

/** Products through the Data API. RLS decides which rows come back. */
@Service()
export class ProductsData {
  private readonly neon = inject(NeonClient);

  async list(): Promise<Product[]> {
    const db = await this.neon.db();
    const { data, error } = await db
      .from('products')
      .select('id, owner_id, name, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      throw new Error(`Could not load products: ${error.message}`);
    }
    return data;
  }

  async add(name: string): Promise<Product> {
    const db = await this.neon.db();
    // No owner_id: the column defaults to auth.uid(), and RLS rejects any other owner.
    const { data, error } = await db.from('products').insert({ name }).select().single();
    if (error) {
      throw new Error(`Could not add the product: ${error.message}`);
    }
    return data;
  }
}
```

Admin-only functions from [rls-patterns.md](rls-patterns.md) are called the same way: `await db.rpc('grant_role', { target_user, role_name: 'manager' })`. The database rejects callers who aren't admins.

## Rules for the client

- **Never filter for security in the client.** `.eq('owner_id', userId)` is fine for display, but RLS is what protects the data.
- **Reload user data when the session changes.** After `signIn` or `signOut`, reload every `resource` that holds rows, so one user never sees another's cached data.
- **Expect permission errors.** Postgres code `42501` means RLS or a missing grant refused the request. Show a plain message, and treat it as a bug in the policies if a user hits it during normal use.
- **Signed-out requests carry no token, and the Data API answers `400`.** That's expected when nothing is public. For data visitors may read, grant `select` to `anonymous` and send an anonymous token instead: `fetchWithToken(async () => (await auth.token()).data?.token ?? (await auth.getAnonymousToken()).data?.token ?? null)`.
- **Signing out doesn't revoke tokens already issued.** A token stays valid until it expires (up to 15 minutes).
- **Unit tests don't touch Neon.** Provide a fake in place of each data service. The persona test in [testing.md](testing.md) covers the policies.
