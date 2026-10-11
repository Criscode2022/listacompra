export const SCHEMA_STATEMENTS = [
  `CREATE SCHEMA IF NOT EXISTS mcp`,
  `CREATE TABLE IF NOT EXISTS mcp.oauth_clients (
    id text PRIMARY KEY,
    name text NOT NULL,
    redirect_uris text NOT NULL,
    secret_hash text,
    auth_method text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS mcp.oauth_requests (
    id text PRIMARY KEY,
    client_id text NOT NULL,
    redirect_uri text NOT NULL,
    state text NOT NULL,
    code_challenge text NOT NULL,
    scopes text NOT NULL,
    resource text NOT NULL,
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz
  )`,
  `CREATE TABLE IF NOT EXISTS mcp.oauth_codes (
    code_hash text PRIMARY KEY,
    client_id text NOT NULL,
    user_id text NOT NULL,
    redirect_uri text NOT NULL,
    code_challenge text NOT NULL,
    scopes text NOT NULL,
    resource text NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at timestamptz
  )`,
  `CREATE TABLE IF NOT EXISTS mcp.oauth_tokens (
    token_hash text PRIMARY KEY,
    kind text NOT NULL,
    client_id text NOT NULL,
    user_id text NOT NULL,
    scopes text NOT NULL,
    resource text NOT NULL,
    expires_at timestamptz NOT NULL,
    family_id text NOT NULL,
    rotated_at timestamptz
  )`,
  `CREATE INDEX IF NOT EXISTS oauth_tokens_family_idx ON mcp.oauth_tokens (family_id)`,
  `CREATE TABLE IF NOT EXISTS mcp.api_keys (
    id text PRIMARY KEY,
    user_id text NOT NULL,
    label text NOT NULL,
    prefix text NOT NULL,
    key_hash text NOT NULL UNIQUE,
    scopes text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz,
    revoked_at timestamptz
  )`,
];
