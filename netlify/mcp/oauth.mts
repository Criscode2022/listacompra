import { randomUUID } from "node:crypto";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  AUTH_CODE_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  SCOPES,
  ServiceError,
  appendQuery,
  basicCredentials,
  canonicalResource,
  formatScopes,
  isAdminRole,
  isAllowedRedirect,
  isScope,
  parseScopes,
  publicOriginFromRequest,
  randomToken,
  resourceMatches,
  safeEqual,
  scopesForUser,
  sha256,
  verifyPkce,
  type Scope,
} from "./domain.mts";
import { errorPage, loginPage } from "./html.mts";
import { verifyCredentials } from "./services.mts";
import type { ClientAuthMethod, Store, StoredClient, TokenRecord } from "./store.mts";

const SECURITY_HEADERS = {
  "cache-control": "no-store",
  pragma: "no-cache",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};

export function protectedResourceMetadata(origin: string): Record<string, unknown> {
  return {
    resource: canonicalResource(origin),
    authorization_servers: [origin],
    scopes_supported: [...SCOPES],
    bearer_methods_supported: ["header"],
  };
}

export function authorizationServerMetadata(origin: string): Record<string, unknown> {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/authorize`,
    token_endpoint: `${origin}/token`,
    registration_endpoint: `${origin}/register`,
    revocation_endpoint: `${origin}/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_basic", "client_secret_post"],
    revocation_endpoint_auth_methods_supported: ["none", "client_secret_basic", "client_secret_post"],
    scopes_supported: [...SCOPES],
  };
}

export async function handleOAuth(
  request: Request,
  store: Store,
  configuredOrigin: string | undefined,
): Promise<Response> {
  const origin = publicOriginFromRequest(request, configuredOrigin);
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (request.method === "GET" && isMetadataPath(path)) {
    const body = path.includes("oauth-protected-resource")
      ? protectedResourceMetadata(origin)
      : authorizationServerMetadata(origin);
    return json(body, 200);
  }
  if (path === "/register" && request.method === "POST") return registerClient(request, store);
  if (path === "/authorize" && request.method === "GET") return startAuthorization(request, store, origin);
  if (path === "/authorize" && request.method === "POST") return finishAuthorization(request, store);
  if (path === "/token" && request.method === "POST") return issueToken(request, store, origin);
  if (path === "/revoke" && request.method === "POST") return revoke(request, store);
  return json({ error: "not_found" }, 404);
}

function isMetadataPath(path: string): boolean {
  return (
    path === "/.well-known/oauth-protected-resource" ||
    path === "/.well-known/oauth-protected-resource/mcp" ||
    path === "/.well-known/oauth-authorization-server" ||
    path === "/.well-known/oauth-authorization-server/mcp"
  );
}

async function registerClient(request: Request, store: Store): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return oauthError("invalid_client_metadata", "Registration body must be JSON.", 400);
  }
  const redirectUris = Array.isArray(body["redirect_uris"]) ? body["redirect_uris"] : [];
  if (
    redirectUris.length < 1 ||
    redirectUris.length > 10 ||
    redirectUris.some((uri) => typeof uri !== "string" || !isAllowedRedirect(uri))
  ) {
    return oauthError(
      "invalid_redirect_uri",
      "redirect_uris must be 1 to 10 https URLs, or http URLs on localhost or 127.0.0.1.",
      400,
    );
  }
  const grants = arrayOfStrings(body["grant_types"]) ?? ["authorization_code", "refresh_token"];
  if (grants.some((grant) => grant !== "authorization_code" && grant !== "refresh_token")) {
    return oauthError("invalid_client_metadata", "Only authorization_code and refresh_token are supported.", 400);
  }
  const responses = arrayOfStrings(body["response_types"]) ?? ["code"];
  if (responses.some((response) => response !== "code")) {
    return oauthError("invalid_client_metadata", "Only the code response type is supported.", 400);
  }
  const authMethod = clientAuthMethod(body["token_endpoint_auth_method"]);
  if (!authMethod) {
    return oauthError("invalid_client_metadata", "Unsupported token_endpoint_auth_method.", 400);
  }
  const name = typeof body["client_name"] === "string" && body["client_name"].trim()
    ? body["client_name"].trim().slice(0, 120)
    : "MCP client";
  const clientId = randomToken("lc_client_");
  const secret = authMethod === "none" ? null : randomToken("lc_sec_");
  const client: StoredClient = {
    id: clientId,
    name,
    redirectUris: redirectUris as string[],
    secretHash: secret ? sha256(secret) : null,
    authMethod,
  };
  await store.insertClient(client);
  return json(
    {
      client_id: clientId,
      client_secret: secret ?? undefined,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret_expires_at: 0,
      client_name: name,
      redirect_uris: client.redirectUris,
      grant_types: grants,
      response_types: ["code"],
      token_endpoint_auth_method: authMethod,
    },
    201,
  );
}

async function startAuthorization(request: Request, store: Store, origin: string): Promise<Response> {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id") ?? "";
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const challenge = url.searchParams.get("code_challenge") ?? "";
  const method = url.searchParams.get("code_challenge_method") ?? "";
  const resource = url.searchParams.get("resource") ?? "";
  const responseType = url.searchParams.get("response_type") ?? "";
  const client = await store.getClient(clientId);

  if (!client || !client.redirectUris.includes(redirectUri) || !isAllowedRedirect(redirectUri)) {
    return html(errorPage("El cliente o la URL de retorno no son válidos."), 400);
  }
  if (!state) return redirectError(redirectUri, "invalid_request", "state is required.");
  if (responseType !== "code") {
    return redirectError(redirectUri, "unsupported_response_type", "Only code is supported.", state);
  }
  if (method !== "S256" || challenge.length < 43) {
    return redirectError(redirectUri, "invalid_request", "PKCE S256 is required.", state);
  }
  if (!resourceMatches(resource, origin)) {
    return redirectError(redirectUri, "invalid_target", "resource must be this MCP server.", state);
  }
  let scopes: Scope[];
  try {
    scopes = url.searchParams.get("scope")
      ? parseScopes(url.searchParams.get("scope"))
      : scopesForUser(false);
  } catch {
    return redirectError(redirectUri, "invalid_scope", "Unknown scope.", state);
  }
  const requestId = randomUUID();
  await store.insertAuthRequest({
    id: requestId,
    clientId,
    redirectUri,
    state,
    codeChallenge: challenge,
    scopes,
    resource,
    expiresAt: new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000).toISOString(),
    consumed: false,
  });
  return html(loginPage({ requestId, clientName: client.name, scopes }));
}

async function finishAuthorization(request: Request, store: Store): Promise<Response> {
  const form = await readForm(request);
  const requestId = form.get("request_id") ?? "";
  const pending = await store.getAuthRequest(requestId);
  if (!pending) return html(errorPage("La solicitud de acceso ha caducado. Vuelve a conectar el cliente."), 400);
  const client = await store.getClient(pending.clientId);
  if (!client) return html(errorPage("El cliente ya no existe."), 400);
  const user = await verifyCredentials(store, form.get("email") ?? "", form.get("password") ?? "");
  if (!user) {
    return html(
      loginPage({
        requestId,
        clientName: client.name,
        scopes: pending.scopes,
        error: "Email o contraseña incorrectos, o la cuenta está bloqueada.",
      }),
      401,
    );
  }
  const allowed = scopesForUser(isAdminRole(user.role));
  const granted = (pending.scopes.length ? pending.scopes : allowed).filter((scope) => allowed.includes(scope));
  if (granted.length === 0) {
    return redirectError(pending.redirectUri, "invalid_scope", "This account cannot grant the requested scopes.", pending.state);
  }
  const consumed = await store.consumeAuthRequest(requestId);
  if (!consumed) return html(errorPage("La solicitud de acceso ya se ha usado."), 400);
  const code = randomToken("lc_code_");
  await store.insertAuthCode(
    sha256(code),
    {
      clientId: consumed.clientId,
      userId: user.id,
      redirectUri: consumed.redirectUri,
      codeChallenge: consumed.codeChallenge,
      scopes: granted,
      resource: consumed.resource,
    },
    new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000).toISOString(),
  );
  return redirect(appendQuery(consumed.redirectUri, { code, state: consumed.state }));
}

async function issueToken(request: Request, store: Store, origin: string): Promise<Response> {
  const form = await readForm(request);
  const client = await authenticateClient(request, store, form);
  if (client instanceof Response) return client;
  const grant = form.get("grant_type");
  if (grant === "authorization_code") return exchangeCode(store, client, form, origin);
  if (grant === "refresh_token") return refresh(store, client, form, origin);
  return oauthError("unsupported_grant_type", "Use authorization_code or refresh_token.", 400);
}

async function exchangeCode(
  store: Store,
  client: StoredClient,
  form: URLSearchParams,
  origin: string,
): Promise<Response> {
  const code = form.get("code") ?? "";
  const verifier = form.get("code_verifier") ?? "";
  const redirectUri = form.get("redirect_uri") ?? "";
  const resource = form.get("resource") ?? "";
  if (!resourceMatches(resource, origin)) {
    return oauthError("invalid_target", "resource must be this MCP server.", 400);
  }
  const consumed = await store.consumeAuthCode(sha256(code));
  if (!consumed || consumed.clientId !== client.id || consumed.redirectUri !== redirectUri) {
    return oauthError("invalid_grant", "Authorization code is invalid or expired.", 400);
  }
  if (!verifyPkce(verifier, consumed.codeChallenge)) {
    return oauthError("invalid_grant", "PKCE verification failed.", 400);
  }
  return tokenResponse(store, {
    clientId: client.id,
    userId: consumed.userId,
    scopes: consumed.scopes,
    resource: consumed.resource,
    familyId: randomUUID(),
  });
}

async function refresh(
  store: Store,
  client: StoredClient,
  form: URLSearchParams,
  origin: string,
): Promise<Response> {
  const refreshToken = form.get("refresh_token") ?? "";
  const resource = form.get("resource") ?? "";
  if (resource && !resourceMatches(resource, origin)) {
    return oauthError("invalid_target", "resource must be this MCP server.", 400);
  }
  const access = randomToken("ola_");
  const nextRefresh = randomToken("olr_");
  const now = Date.now();
  const rotated = await store.rotateRefresh(
    sha256(refreshToken),
    client.id,
    resource || null,
    sha256(access),
    sha256(nextRefresh),
    new Date(now + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString(),
    new Date(now + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString(),
  );
  if (rotated === "reused") {
    return oauthError("invalid_grant", "Refresh token reuse revoked the session.", 400);
  }
  if (!rotated) {
    return oauthError("invalid_grant", "Refresh token is invalid or expired.", 400);
  }
  return json({
    access_token: access,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: nextRefresh,
    scope: formatScopes(rotated.scopes),
  });
}

async function tokenResponse(store: Store, record: TokenRecord): Promise<Response> {
  const access = randomToken("ola_");
  const refreshToken = randomToken("olr_");
  const now = Date.now();
  await store.insertToken(
    sha256(access),
    "access",
    record,
    new Date(now + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString(),
  );
  await store.insertToken(
    sha256(refreshToken),
    "refresh",
    record,
    new Date(now + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString(),
  );
  return json({
    access_token: access,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: formatScopes(record.scopes),
  });
}

async function revoke(request: Request, store: Store): Promise<Response> {
  const form = await readForm(request);
  const client = await authenticateClient(request, store, form);
  if (client instanceof Response) return client;
  const token = form.get("token");
  if (token) await store.revokeToken(sha256(token));
  return new Response(null, { status: 200, headers: SECURITY_HEADERS });
}

async function authenticateClient(
  request: Request,
  store: Store,
  form: URLSearchParams,
): Promise<StoredClient | Response> {
  const basic = basicCredentials(request);
  const clientId = basic?.clientId || form.get("client_id") || "";
  const presented = basic?.clientSecret || form.get("client_secret") || "";
  const client = clientId ? await store.getClient(clientId) : null;
  if (!client) return oauthError("invalid_client", "Unknown client.", 401);
  if (client.secretHash) {
    if (!presented || !safeEqual(sha256(presented), client.secretHash)) {
      return oauthError("invalid_client", "Client authentication failed.", 401);
    }
    return client;
  }
  if (presented) return oauthError("invalid_client", "Public client does not use a secret.", 401);
  return client;
}

function clientAuthMethod(value: unknown): ClientAuthMethod | null {
  if (value === undefined) return "none";
  if (value === "none" || value === "client_secret_basic" || value === "client_secret_post") return value;
  return null;
}

function arrayOfStrings(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (value.some((item) => typeof item !== "string")) return null;
  return value;
}

async function readForm(request: Request): Promise<URLSearchParams> {
  const text = await request.text();
  return new URLSearchParams(text);
}

function redirectError(uri: string, error: string, description: string, state?: string): Response {
  const params: Record<string, string> = { error, error_description: description };
  if (state) params["state"] = state;
  return redirect(appendQuery(uri, params));
}

function redirect(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: { location, ...SECURITY_HEADERS },
  });
}

function oauthError(error: string, description: string, status: number): Response {
  return json({ error, error_description: description }, status);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...SECURITY_HEADERS },
  });
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...SECURITY_HEADERS },
  });
}

export function scopeList(value: string | null): Scope[] {
  const scopes = parseScopes(value);
  if (scopes.some((scope) => !isScope(scope))) {
    throw new ServiceError("Unknown scope.", "bad_request");
  }
  return scopes;
}
