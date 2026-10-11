import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import {
  isBanned,
  iso,
  type Category,
  type PublicUser,
  type Scope,
  type ShoppingTask,
  type Unit,
} from "./domain.mts";
import { SCHEMA_STATEMENTS } from "./schema.mts";
import type {
  ApiKeyRecord,
  AuthCodeRecord,
  AuthRequestRecord,
  ClientAuthMethod,
  ListTasksQuery,
  ListUsersQuery,
  NewTask,
  NewUser,
  Store,
  StoredClient,
  TaskPatch,
  TokenRecord,
  UserPatch,
} from "./store.mts";

type Sql = NeonQueryFunction<false, false>;
type Row = Record<string, unknown>;

export class NeonStore implements Store {
  private readonly sql: Sql;

  constructor(databaseUrl: string) {
    this.sql = neon(databaseUrl);
  }

  async ensureSchema(): Promise<void> {
    for (const statement of SCHEMA_STATEMENTS) {
      await this.sql.query(statement);
    }
    await this.sql.query(
      `DELETE FROM mcp.oauth_requests WHERE expires_at < now() - interval '1 day'`,
    );
    await this.sql.query(
      `DELETE FROM mcp.oauth_codes WHERE used_at IS NOT NULL AND used_at < now() - interval '1 day'`,
    );
  }

  async listUsers(query: ListUsersQuery): Promise<{ users: PublicUser[]; total: number }> {
    const search = query.search?.trim() ? `%${escapeLike(query.search.trim())}%` : null;
    const where = `WHERE ($1::text IS NULL OR name ILIKE $1 ESCAPE '\\' OR email ILIKE $1 ESCAPE '\\')`;
    const totals = await this.sql.query(
      `SELECT count(*)::int AS total FROM neon_auth."user" ${where}`,
      [search],
    );
    const rows = await this.sql.query(
      `SELECT id, name, email, "emailVerified", role, banned, "banReason", "banExpires", "createdAt", "updatedAt"
       FROM neon_auth."user"
       ${where}
       ORDER BY "createdAt" DESC
       LIMIT $2 OFFSET $3`,
      [search, query.limit, query.offset],
    );
    const total = totals[0] ? numberValue(totals[0], "total") : 0;
    return { total, users: rows.map(userFromRow) };
  }

  async getUserById(id: string): Promise<PublicUser | null> {
    const rows = await this.sql.query(
      `SELECT id, name, email, "emailVerified", role, banned, "banReason", "banExpires", "createdAt", "updatedAt"
       FROM neon_auth."user" WHERE id = $1::uuid`,
      [id],
    );
    const row = rows[0];
    if (!row) return null;
    const user = userFromRow(row);
    user.basicMode = await this.getBasicMode(user.id);
    return user;
  }

  async getUserByEmail(email: string): Promise<PublicUser | null> {
    const rows = await this.sql.query(
      `SELECT id, name, email, "emailVerified", role, banned, "banReason", "banExpires", "createdAt", "updatedAt"
       FROM neon_auth."user" WHERE lower(email) = lower($1)`,
      [email],
    );
    return rows[0] ? userFromRow(rows[0]) : null;
  }

  async getPasswordHash(userId: string): Promise<string | null> {
    const rows = await this.sql.query(
      `SELECT password FROM neon_auth.account
       WHERE "userId" = $1::uuid AND "providerId" = 'credential'`,
      [userId],
    );
    const password = rows[0]?.["password"];
    return typeof password === "string" ? password : null;
  }

  async insertUser(input: NewUser): Promise<PublicUser> {
    const rows = await this.sql.transaction((txn) => [
      txn.query(
        `INSERT INTO neon_auth."user"
           (id, name, email, "emailVerified", role, banned, "createdAt", "updatedAt")
         VALUES ($1::uuid, $2, $3, $4, $5, false, now(), now())
         RETURNING id, name, email, "emailVerified", role, banned, "banReason", "banExpires", "createdAt", "updatedAt"`,
        [input.id, input.name, input.email, input.emailVerified, input.role],
      ),
      txn.query(
        `INSERT INTO neon_auth.account
           (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
         VALUES ($1::uuid, $2, 'credential', $2::uuid, $3, now(), now())`,
        [crypto.randomUUID(), input.id, input.passwordHash],
      ),
    ]);
    const user = userFromRow(firstRow(rows[0]));
    user.basicMode = false;
    return user;
  }

  async updateUser(id: string, patch: UserPatch): Promise<PublicUser | null> {
    const current = await this.getUserById(id);
    if (!current) return null;
    const rows = await this.sql.query(
      `UPDATE neon_auth."user"
       SET name = $2,
           email = $3,
           role = $4,
           "emailVerified" = $5,
           "updatedAt" = now()
       WHERE id = $1::uuid
       RETURNING id, name, email, "emailVerified", role, banned, "banReason", "banExpires", "createdAt", "updatedAt"`,
      [
        id,
        patch.name ?? current.name,
        patch.email ?? current.email,
        patch.role === undefined ? current.role : patch.role,
        patch.emailVerified ?? current.emailVerified,
      ],
    );
    const row = rows[0];
    if (!row) return null;
    if (patch.basicMode !== undefined) {
      await this.sql.query(
        `INSERT INTO user_settings (user_id, basic_mode, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (user_id) DO UPDATE SET basic_mode = EXCLUDED.basic_mode, updated_at = now()`,
        [id, patch.basicMode],
      );
    }
    const user = userFromRow(row);
    user.basicMode = patch.basicMode ?? (await this.getBasicMode(id));
    return user;
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<boolean> {
    const updated = await this.sql.query(
      `UPDATE neon_auth.account
       SET password = $2, "updatedAt" = now()
       WHERE "userId" = $1::uuid AND "providerId" = 'credential'
       RETURNING id`,
      [userId, passwordHash],
    );
    if (!updated[0]) {
      const user = await this.getUserById(userId);
      if (!user) return false;
      await this.sql.query(
        `INSERT INTO neon_auth.account
           (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
         VALUES ($1::uuid, $2, 'credential', $2::uuid, $3, now(), now())`,
        [crypto.randomUUID(), userId, passwordHash],
      );
    }
    await this.sql.transaction((txn) => [
      txn.query(`DELETE FROM neon_auth.session WHERE "userId" = $1::uuid`, [userId]),
      txn.query(`DELETE FROM mcp.oauth_tokens WHERE user_id = $1`, [userId]),
    ]);
    return true;
  }

  async banUser(id: string, reason: string | null, banExpires: string | null): Promise<PublicUser | null> {
    const rows = await this.sql.query(
      `UPDATE neon_auth."user"
       SET banned = true, "banReason" = $2, "banExpires" = $3, "updatedAt" = now()
       WHERE id = $1::uuid
       RETURNING id, name, email, "emailVerified", role, banned, "banReason", "banExpires", "createdAt", "updatedAt"`,
      [id, reason, banExpires],
    );
    if (!rows[0]) return null;
    await this.revokeStoredAccess(id);
    return userFromRow(rows[0]);
  }

  async unbanUser(id: string): Promise<PublicUser | null> {
    const rows = await this.sql.query(
      `UPDATE neon_auth."user"
       SET banned = false, "banReason" = NULL, "banExpires" = NULL, "updatedAt" = now()
       WHERE id = $1::uuid
       RETURNING id, name, email, "emailVerified", role, banned, "banReason", "banExpires", "createdAt", "updatedAt"`,
      [id],
    );
    return rows[0] ? userFromRow(rows[0]) : null;
  }

  async deleteUser(id: string): Promise<boolean> {
    const existing = await this.getUserById(id);
    if (!existing) return false;
    await this.sql.transaction((txn) => [
      txn.query(`DELETE FROM products WHERE user_id = $1`, [id]),
      txn.query(`DELETE FROM user_settings WHERE user_id = $1`, [id]),
      txn.query(`DELETE FROM mcp.api_keys WHERE user_id = $1`, [id]),
      txn.query(`DELETE FROM mcp.oauth_tokens WHERE user_id = $1`, [id]),
      txn.query(`DELETE FROM mcp.oauth_codes WHERE user_id = $1`, [id]),
      txn.query(`DELETE FROM neon_auth."user" WHERE id = $1::uuid`, [id]),
    ]);
    return true;
  }

  async findSessionUser(token: string, tokenHash: string): Promise<PublicUser | null> {
    const rows = await this.sql.query(
      `SELECT u.id, u.name, u.email, u."emailVerified", u.role, u.banned, u."banReason", u."banExpires",
              u."createdAt", u."updatedAt"
       FROM neon_auth.session s
       JOIN neon_auth."user" u ON u.id = s."userId"
       WHERE s."expiresAt" > now() AND (s.token = $1 OR s.token = $2)
       LIMIT 1`,
      [token, tokenHash],
    );
    const row = rows[0];
    if (!row) return null;
    const user = userFromRow(row);
    return isBanned(user) ? null : user;
  }

  async listTasks(query: ListTasksQuery): Promise<{ tasks: ShoppingTask[]; total: number }> {
    const clauses = [`user_id = $1`];
    const params: unknown[] = [query.userId];
    if (query.view === "lista") clauses.push(`checked = false AND urgent = false`);
    if (query.view === "despensa") clauses.push(`urgent = false`);
    if (query.view === "urgente") clauses.push(`urgent = true`);
    if (query.category) {
      params.push(query.category);
      clauses.push(`category = $${params.length}`);
    }
    if (query.checked !== undefined) {
      params.push(query.checked);
      clauses.push(`checked = $${params.length}`);
    }
    if (query.query) {
      params.push(`%${escapeLike(query.query)}%`);
      clauses.push(`name ILIKE $${params.length} ESCAPE '\\'`);
    }
    const where = clauses.join(" AND ");
    const totals = await this.sql.query(
      `SELECT count(*)::int AS total FROM products WHERE ${where}`,
      params,
    );
    const pageParams = [...params, query.limit, query.offset];
    const rows = await this.sql.query(
      `SELECT user_id, name, checked, quantity, urgent, unit, category, created_at, updated_at
       FROM products
       WHERE ${where}
       ORDER BY name ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      pageParams,
    );
    const total = totals[0] ? numberValue(totals[0], "total") : 0;
    return { total, tasks: rows.map(taskFromRow) };
  }

  async getTask(userId: string, name: string): Promise<ShoppingTask | null> {
    const rows = await this.sql.query(
      `SELECT user_id, name, checked, quantity, urgent, unit, category, created_at, updated_at
       FROM products WHERE user_id = $1 AND name = $2`,
      [userId, name],
    );
    return rows[0] ? taskFromRow(rows[0]) : null;
  }

  async insertTask(task: NewTask): Promise<ShoppingTask> {
    const rows = await this.sql.query(
      `INSERT INTO products (user_id, name, checked, quantity, urgent, unit, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING user_id, name, checked, quantity, urgent, unit, category, created_at, updated_at`,
      [task.userId, task.name, task.checked, task.quantity, task.urgent, task.unit, task.category],
    );
    return taskFromRow(firstRow(rows));
  }

  async updateTask(userId: string, name: string, patch: TaskPatch): Promise<ShoppingTask | null> {
    const current = await this.getTask(userId, name);
    if (!current) return null;
    const rows = await this.sql.query(
      `UPDATE products
       SET name = $3, checked = $4, quantity = $5, urgent = $6, unit = $7, category = $8, updated_at = now()
       WHERE user_id = $1 AND name = $2
       RETURNING user_id, name, checked, quantity, urgent, unit, category, created_at, updated_at`,
      [
        userId,
        name,
        patch.name ?? current.name,
        patch.checked ?? current.checked,
        patch.quantity ?? current.quantity,
        patch.urgent ?? current.urgent,
        patch.unit ?? current.unit,
        patch.category ?? current.category,
      ],
    );
    return rows[0] ? taskFromRow(rows[0]) : null;
  }

  async deleteTask(userId: string, name: string): Promise<boolean> {
    const rows = await this.sql.query(
      `DELETE FROM products WHERE user_id = $1 AND name = $2 RETURNING name`,
      [userId, name],
    );
    return rows.length > 0;
  }

  async getBasicMode(userId: string): Promise<boolean> {
    const rows = await this.sql.query(
      `SELECT basic_mode FROM user_settings WHERE user_id = $1`,
      [userId],
    );
    return Boolean(rows[0]?.["basic_mode"]);
  }

  async insertClient(client: StoredClient): Promise<void> {
    await this.sql.query(
      `INSERT INTO mcp.oauth_clients (id, name, redirect_uris, secret_hash, auth_method)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        client.id,
        client.name,
        JSON.stringify(client.redirectUris),
        client.secretHash,
        client.authMethod,
      ],
    );
  }

  async getClient(id: string): Promise<StoredClient | null> {
    const rows = await this.sql.query(
      `SELECT id, name, redirect_uris, secret_hash, auth_method FROM mcp.oauth_clients WHERE id = $1`,
      [id],
    );
    return rows[0] ? clientFromRow(rows[0]) : null;
  }

  async insertAuthRequest(request: AuthRequestRecord): Promise<void> {
    await this.sql.query(
      `INSERT INTO mcp.oauth_requests
         (id, client_id, redirect_uri, state, code_challenge, scopes, resource, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        request.id,
        request.clientId,
        request.redirectUri,
        request.state,
        request.codeChallenge,
        request.scopes.join(" "),
        request.resource,
        request.expiresAt,
      ],
    );
  }

  async getAuthRequest(id: string): Promise<AuthRequestRecord | null> {
    const rows = await this.sql.query(
      `SELECT id, client_id, redirect_uri, state, code_challenge, scopes, resource, expires_at, consumed_at
       FROM mcp.oauth_requests
       WHERE id = $1 AND consumed_at IS NULL AND expires_at > now()`,
      [id],
    );
    return rows[0] ? authRequestFromRow(rows[0]) : null;
  }

  async consumeAuthRequest(id: string): Promise<AuthRequestRecord | null> {
    const rows = await this.sql.query(
      `UPDATE mcp.oauth_requests
       SET consumed_at = now()
       WHERE id = $1 AND consumed_at IS NULL AND expires_at > now()
       RETURNING id, client_id, redirect_uri, state, code_challenge, scopes, resource, expires_at, consumed_at`,
      [id],
    );
    return rows[0] ? authRequestFromRow(rows[0]) : null;
  }

  async insertAuthCode(codeHash: string, code: AuthCodeRecord, expiresAt: string): Promise<void> {
    await this.sql.query(
      `INSERT INTO mcp.oauth_codes
         (code_hash, client_id, user_id, redirect_uri, code_challenge, scopes, resource, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        codeHash,
        code.clientId,
        code.userId,
        code.redirectUri,
        code.codeChallenge,
        code.scopes.join(" "),
        code.resource,
        expiresAt,
      ],
    );
  }

  async consumeAuthCode(codeHash: string): Promise<AuthCodeRecord | null> {
    const rows = await this.sql.query(
      `UPDATE mcp.oauth_codes
       SET used_at = now()
       WHERE code_hash = $1 AND used_at IS NULL AND expires_at > now()
       RETURNING client_id, user_id, redirect_uri, code_challenge, scopes, resource`,
      [codeHash],
    );
    return rows[0] ? authCodeFromRow(rows[0]) : null;
  }

  async insertToken(
    tokenHash: string,
    kind: "access" | "refresh",
    record: TokenRecord,
    expiresAt: string,
  ): Promise<void> {
    await this.sql.query(
      `INSERT INTO mcp.oauth_tokens
         (token_hash, kind, client_id, user_id, scopes, resource, expires_at, family_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        tokenHash,
        kind,
        record.clientId,
        record.userId,
        record.scopes.join(" "),
        record.resource,
        expiresAt,
        record.familyId,
      ],
    );
  }

  async findAccessToken(tokenHash: string): Promise<(TokenRecord & { user: PublicUser }) | null> {
    const rows = await this.sql.query(
      `SELECT t.client_id, t.user_id, t.scopes, t.resource, t.family_id,
              u.id, u.name, u.email, u."emailVerified", u.role, u.banned, u."banReason", u."banExpires",
              u."createdAt", u."updatedAt"
       FROM mcp.oauth_tokens t
       JOIN neon_auth."user" u ON u.id::text = t.user_id
       WHERE t.token_hash = $1 AND t.kind = 'access' AND t.expires_at > now()`,
      [tokenHash],
    );
    const row = rows[0];
    if (!row) return null;
    const user = userFromRow(row);
    if (isBanned(user)) return null;
    return { ...tokenFromRow(row), user };
  }

  async rotateRefresh(
    oldHash: string,
    expectedClientId: string,
    expectedResource: string | null,
    accessHash: string,
    refreshHash: string,
    accessExpiresAt: string,
    refreshExpiresAt: string,
  ): Promise<TokenRecord | "reused" | null> {
    const rows = await this.sql.query(
      `WITH rotated AS (
         UPDATE mcp.oauth_tokens
         SET rotated_at = now()
         WHERE token_hash = $1
           AND kind = 'refresh'
           AND client_id = $2
           AND ($3::text IS NULL OR resource = $3)
           AND rotated_at IS NULL
           AND expires_at > now()
         RETURNING client_id, user_id, scopes, resource, family_id
       ),
       inserted AS (
         INSERT INTO mcp.oauth_tokens
           (token_hash, kind, client_id, user_id, scopes, resource, expires_at, family_id)
         SELECT $4, 'access', client_id, user_id, scopes, resource, $5, family_id FROM rotated
         UNION ALL
         SELECT $6, 'refresh', client_id, user_id, scopes, resource, $7, family_id FROM rotated
         RETURNING token_hash
       )
       SELECT client_id, user_id, scopes, resource, family_id FROM rotated`,
      [
        oldHash,
        expectedClientId,
        expectedResource,
        accessHash,
        accessExpiresAt,
        refreshHash,
        refreshExpiresAt,
      ],
    );
    if (rows[0]) return tokenFromRow(rows[0]);
    const existing = await this.sql.query(
      `SELECT client_id, family_id, rotated_at, expires_at
       FROM mcp.oauth_tokens WHERE token_hash = $1 AND kind = 'refresh'`,
      [oldHash],
    );
    const row = existing[0];
    if (!row || row["client_id"] !== expectedClientId) return null;
    if (expectedResource && row["resource"] !== expectedResource) return null;
    if (row["rotated_at"]) {
      await this.sql.query(`DELETE FROM mcp.oauth_tokens WHERE family_id = $1`, [row["family_id"]]);
      return "reused";
    }
    return null;
  }

  async revokeToken(tokenHash: string): Promise<void> {
    const rows = await this.sql.query(
      `SELECT kind, family_id FROM mcp.oauth_tokens WHERE token_hash = $1`,
      [tokenHash],
    );
    const row = rows[0];
    if (!row) return;
    if (row["kind"] === "refresh") {
      await this.sql.query(`DELETE FROM mcp.oauth_tokens WHERE family_id = $1`, [row["family_id"]]);
      return;
    }
    await this.sql.query(`DELETE FROM mcp.oauth_tokens WHERE token_hash = $1`, [tokenHash]);
  }

  async insertApiKey(record: ApiKeyRecord, keyHash: string): Promise<void> {
    await this.sql.query(
      `INSERT INTO mcp.api_keys (id, user_id, label, prefix, key_hash, scopes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [record.id, record.userId, record.label, record.prefix, keyHash, record.scopes.join(" "), record.createdAt],
    );
  }

  async listApiKeys(userId: string): Promise<ApiKeyRecord[]> {
    const rows = await this.sql.query(
      `SELECT id, user_id, label, prefix, scopes, created_at, last_used_at, revoked_at
       FROM mcp.api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return rows.map(apiKeyFromRow);
  }

  async revokeApiKey(id: string, userId: string): Promise<boolean> {
    const rows = await this.sql.query(
      `UPDATE mcp.api_keys SET revoked_at = now()
       WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
       RETURNING id`,
      [id, userId],
    );
    return rows.length > 0;
  }

  async findActiveApiKey(keyHash: string): Promise<{ key: ApiKeyRecord; user: PublicUser } | null> {
    const rows = await this.sql.query(
      `UPDATE mcp.api_keys k
       SET last_used_at = now()
       FROM neon_auth."user" u
       WHERE k.key_hash = $1 AND k.revoked_at IS NULL AND u.id::text = k.user_id
       RETURNING k.id, k.user_id, k.label, k.prefix, k.scopes, k.created_at, k.last_used_at, k.revoked_at,
                 u.id AS uid, u.name, u.email, u."emailVerified", u.role, u.banned, u."banReason",
                 u."banExpires", u."createdAt", u."updatedAt"`,
      [keyHash],
    );
    const row = rows[0];
    if (!row) return null;
    const user = userFromRow({
      ...row,
      id: row["uid"],
    });
    if (isBanned(user)) return null;
    return { key: apiKeyFromRow(row), user };
  }

  private async revokeStoredAccess(userId: string): Promise<void> {
    await this.sql.transaction((txn) => [
      txn.query(`DELETE FROM neon_auth.session WHERE "userId" = $1::uuid`, [userId]),
      txn.query(`DELETE FROM mcp.oauth_tokens WHERE user_id = $1`, [userId]),
      txn.query(
        `UPDATE mcp.api_keys SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId],
      ),
    ]);
  }
}

function firstRow(rows: Row[] | undefined): Row {
  const row = rows?.[0];
  if (!row) throw new Error("Expected a database row.");
  return row;
}

function text(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`Expected text column ${key}.`);
  return value;
}

function numberValue(row: Row, key: string): number {
  const value = row[key];
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Expected numeric column ${key}.`);
  return parsed;
}

function userFromRow(row: Row): PublicUser {
  return {
    id: text(row, "id"),
    name: text(row, "name"),
    email: text(row, "email"),
    emailVerified: Boolean(row["emailVerified"]),
    role: typeof row["role"] === "string" ? row["role"] : null,
    banned: Boolean(row["banned"]),
    banReason: typeof row["banReason"] === "string" ? row["banReason"] : null,
    banExpires: row["banExpires"] ? iso(String(row["banExpires"])) : null,
    createdAt: iso(String(row["createdAt"])),
    updatedAt: iso(String(row["updatedAt"])),
  };
}

function taskFromRow(row: Row): ShoppingTask {
  return {
    userId: text(row, "user_id"),
    name: text(row, "name"),
    checked: Boolean(row["checked"]),
    quantity: numberValue(row, "quantity"),
    urgent: Boolean(row["urgent"]),
    unit: text(row, "unit") as Unit,
    category: text(row, "category") as Category,
    createdAt: iso(String(row["created_at"])),
    updatedAt: iso(String(row["updated_at"])),
  };
}

function clientFromRow(row: Row): StoredClient {
  const redirectUris = JSON.parse(text(row, "redirect_uris")) as unknown;
  if (!Array.isArray(redirectUris) || redirectUris.some((uri) => typeof uri !== "string")) {
    throw new Error("Stored OAuth client has invalid redirect URIs.");
  }
  return {
    id: text(row, "id"),
    name: text(row, "name"),
    redirectUris,
    secretHash: typeof row["secret_hash"] === "string" ? row["secret_hash"] : null,
    authMethod: text(row, "auth_method") as ClientAuthMethod,
  };
}

function scopesFromRow(row: Row): Scope[] {
  return text(row, "scopes").split(/\s+/).filter(Boolean) as Scope[];
}

function authRequestFromRow(row: Row): AuthRequestRecord {
  return {
    id: text(row, "id"),
    clientId: text(row, "client_id"),
    redirectUri: text(row, "redirect_uri"),
    state: text(row, "state"),
    codeChallenge: text(row, "code_challenge"),
    scopes: scopesFromRow(row),
    resource: text(row, "resource"),
    expiresAt: iso(String(row["expires_at"])),
    consumed: row["consumed_at"] != null,
  };
}

function authCodeFromRow(row: Row): AuthCodeRecord {
  return {
    clientId: text(row, "client_id"),
    userId: text(row, "user_id"),
    redirectUri: text(row, "redirect_uri"),
    codeChallenge: text(row, "code_challenge"),
    scopes: scopesFromRow(row),
    resource: text(row, "resource"),
  };
}

function tokenFromRow(row: Row): TokenRecord {
  return {
    clientId: text(row, "client_id"),
    userId: text(row, "user_id"),
    scopes: scopesFromRow(row),
    resource: text(row, "resource"),
    familyId: text(row, "family_id"),
  };
}

function apiKeyFromRow(row: Row): ApiKeyRecord {
  return {
    id: text(row, "id"),
    userId: text(row, "user_id"),
    label: text(row, "label"),
    prefix: text(row, "prefix"),
    scopes: scopesFromRow(row),
    createdAt: iso(String(row["created_at"])),
    lastUsedAt: row["last_used_at"] ? iso(String(row["last_used_at"])) : null,
    revokedAt: row["revoked_at"] ? iso(String(row["revoked_at"])) : null,
  };
}

function escapeLike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}
