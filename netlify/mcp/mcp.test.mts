import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { test } from "node:test";
import { hashPassword } from "@better-auth/utils/password";
import {
  escapeHtml,
  isAllowedRedirect,
  resourceMatches,
  verifyPkce,
} from "./domain.mts";
import { stdioPrincipal } from "./auth.mts";
import { handleHttp } from "./http.mts";
import { MemoryStore, newId } from "./memory-store.mts";
import { createApiKey, revokeApiKey, verifyCredentials } from "./services.mts";

const ORIGIN = "http://127.0.0.1:8787";
const SECRET = "operator-token-0123456789abcdef";
const PASSWORD = "correct-horse";
const ACCEPT = "application/json, text/event-stream";
const PASSWORD_HASH = await hashPassword(PASSWORD);

test("PKCE, redirects, resources, and HTML escaping", () => {
  const verifier = "a".repeat(43);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  assert.equal(verifyPkce(verifier, challenge), true);
  assert.equal(verifyPkce(`${verifier}x`, challenge), false);
  assert.equal(isAllowedRedirect("https://client.example/callback"), true);
  assert.equal(isAllowedRedirect("http://localhost:6274/callback"), true);
  assert.equal(isAllowedRedirect("http://evil.example/callback"), false);
  assert.equal(isAllowedRedirect("https://client.example/callback#fragment"), false);
  assert.equal(resourceMatches(`${ORIGIN}/mcp`, ORIGIN), true);
  assert.equal(resourceMatches(`${ORIGIN}/mcp?x=1`, ORIGIN), false);
  assert.equal(resourceMatches(`${ORIGIN}/other`, ORIGIN), false);
  assert.equal(escapeHtml(`<script>"'&`), "&lt;script&gt;&quot;&#39;&amp;");
});

test("missing DATABASE_URL returns 500 without a secret", async () => {
  const previous = process.env["DATABASE_URL"];
  delete process.env["DATABASE_URL"];
  try {
    const response = await handleHttp(new Request(`${ORIGIN}/mcp`, { method: "POST" }));
    assert.equal(response.status, 500);
    const body = (await response.json()) as { error: string; error_description: string };
    assert.equal(body.error, "server_error");
    assert.equal(body.error_description, "DATABASE_URL is not set.");
    assert.equal(JSON.stringify(body).includes("postgres"), false);
  } finally {
    if (previous === undefined) delete process.env["DATABASE_URL"];
    else process.env["DATABASE_URL"] = previous;
  }
});

test("unauthenticated and wrong-length bearer requests advertise resource metadata", async () => {
  const store = new MemoryStore();
  const missing = await handleHttp(request("/mcp", "POST"), { store, sharedSecret: SECRET, publicUrl: ORIGIN });
  assert.equal(missing.status, 401);
  const header = missing.headers.get("www-authenticate") ?? "";
  assert.match(header, /resource_metadata="http:\/\/127\.0\.0\.1:8787\/\.well-known\/oauth-protected-resource"/);

  const wrongLength = await handleHttp(request("/mcp", "POST", undefined, { authorization: "Bearer short" }), {
    store,
    sharedSecret: SECRET,
    publicUrl: ORIGIN,
  });
  assert.equal(wrongLength.status, 401);
});

test("MCP methods and CORS preflight", async () => {
  const store = new MemoryStore();
  const options = { store, sharedSecret: SECRET, publicUrl: ORIGIN };
  const preflight = await handleHttp(request("/mcp", "OPTIONS"), options);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "*");
  assert.match(preflight.headers.get("access-control-allow-headers") ?? "", /Authorization/);

  const get = await handleHttp(request("/mcp", "GET"), options);
  assert.equal(get.status, 405);
  const deleted = await handleHttp(request("/mcp", "DELETE", undefined, { authorization: `Bearer ${SECRET}` }), options);
  assert.equal(deleted.status, 204);
});

test("MCP_ALLOWED_ORIGIN replaces the wildcard", async () => {
  const previous = process.env["MCP_ALLOWED_ORIGIN"];
  process.env["MCP_ALLOWED_ORIGIN"] = "https://inspector.example";
  try {
    const response = await handleHttp(request("/mcp", "OPTIONS"), {
      store: new MemoryStore(),
      publicUrl: ORIGIN,
    });
    assert.equal(response.headers.get("access-control-allow-origin"), "https://inspector.example");
  } finally {
    if (previous === undefined) delete process.env["MCP_ALLOWED_ORIGIN"];
    else process.env["MCP_ALLOWED_ORIGIN"] = previous;
  }
});

test("initialize and item tools honor shopping-list rules", async () => {
  const store = new MemoryStore();
  const userId = await seedUser(store, "ana@example.com", "user");
  const options = { store, sharedSecret: SECRET, publicUrl: ORIGIN };

  const initialized = await handleHttp(
    rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "0" },
    } }, SECRET),
    options,
  );
  assert.equal(initialized.status, 200);
  const handshake = (await initialized.json()) as { result: { serverInfo: { name: string } } };
  assert.equal(handshake.result.serverInfo.name, "listacompra");

  const listedTools = await handleHttp(rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }, SECRET), options);
  const catalog = (await listedTools.json()) as { result: { tools: { name: string }[] } };
  assert.deepEqual(
    catalog.result.tools.map((entry) => entry.name).sort(),
    ["create_item", "delete_item", "get_current_user", "get_item", "list_items", "set_item_checked", "update_item"],
  );

  const created = await tool(store, SECRET, "create_item", {
    user_id: userId,
    name: " Leche ",
    quantity: 2,
    unit: "l",
    category: "lácteos",
    urgent: true,
  });
  assert.equal(created.name, "Leche");
  assert.equal(created.urgent, true);

  const duplicate = await toolRaw(store, SECRET, "create_item", { user_id: userId, name: "Leche" });
  assert.equal(duplicate.result.isError, true);

  const badCategory = await toolRaw(store, SECRET, "create_item", {
    user_id: userId,
    name: "Pan",
    category: "no-existe",
  });
  assert.ok(badCategory.error || badCategory.result?.isError);

  const one = await tool(store, SECRET, "get_item", { user_id: userId, name: "Leche" });
  assert.equal(one.name, "Leche");

  await tool(store, SECRET, "set_item_checked", { user_id: userId, name: "Leche", checked: true });
  const urgent = await tool(store, SECRET, "list_items", { user_id: userId, view: "urgente" });
  assert.equal(urgent.total, 1);
  assert.equal(urgent.items.length, 1);
  const lista = await tool(store, SECRET, "list_items", { user_id: userId, view: "lista" });
  assert.equal(lista.total, 0);
  const despensa = await tool(store, SECRET, "list_items", { user_id: userId, view: "despensa" });
  assert.equal(despensa.total, 0);

  await tool(store, SECRET, "update_item", { user_id: userId, name: "Leche", urgent: false, checked: false, quantity: 1 });
  const shopping = await tool(store, SECRET, "list_items", { user_id: userId, view: "lista" });
  assert.equal(shopping.total, 1);
  await tool(store, SECRET, "delete_item", { user_id: userId, name: "Leche" });
  const empty = await tool(store, SECRET, "list_items", { user_id: userId, view: "all" });
  assert.equal(empty.total, 0);

  const removed = await toolRaw(store, SECRET, "ban_user", { user_id: userId });
  assert.equal(removed.result.isError, true);
});

test("a read-only API key can list items and a revoked key stops working", async () => {
  const store = new MemoryStore();
  const selfId = await seedUser(store, "self@example.com", "user");
  const operator = stdioPrincipal();
  const minted = await createApiKey(store, operator, {
    userId: selfId,
    label: "phone",
    scopes: ["tasks:read"],
  });
  const listed = await tool(store, minted.apiKey, "list_items", {});
  assert.equal(listed.total, 0);

  const write = await toolRaw(store, minted.apiKey, "create_item", { name: "Pan" });
  assert.equal(write.result.isError, true);

  await assert.rejects(
    () => createApiKey(store, operator, { userId: selfId, label: "admin-key", scopes: ["users:write"] }),
    /Cannot grant scope users:write/,
  );

  await revokeApiKey(store, operator, { userId: selfId, id: minted.key.id });
  const revoked = await handleHttp(rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, minted.apiKey), {
    store,
    sharedSecret: SECRET,
    publicUrl: ORIGIN,
  });
  assert.equal(revoked.status, 401);
});

test("a Neon Auth JWT is the signed-in user, and an expired one says so", async () => {
  const store = new MemoryStore();
  const userId = await seedUser(store, "jwt@example.com", "user");
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const jwk = publicKey.export({ format: "jwk" });
  const keys = [{ kid: "test-key", kty: "OKP", crv: "Ed25519", x: String(jwk.x) }];
  const jwksUrl = "https://auth.example/.well-known/jwks.json";
  const now = 1_800_000_000;
  const token = signJwt(privateKey, { iss: "https://auth.example", aud: "https://auth.example", sub: userId, exp: now + 60 }, "test-key");
  const me = await tool(store, token, "get_current_user", {}, { now, jwksUrl, jwksKeys: keys });
  assert.equal(me.method, "neon_session");
  assert.equal(me.userId, userId);
  assert.equal(me.admin, false);

  const expired = signJwt(privateKey, { iss: "https://auth.example", aud: "https://auth.example", sub: userId, exp: now - 120 }, "test-key");
  const rejected = await handleHttp(rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, expired), {
    store,
    sharedSecret: SECRET,
    publicUrl: ORIGIN,
    now,
    jwksUrl,
    jwksKeys: keys,
  });
  assert.equal(rejected.status, 401);
  const body = (await rejected.json()) as { error_description: string };
  assert.match(body.error_description, /expired/);

  const tampered = `${token.slice(0, -4)}aaaa`;
  const bad = await handleHttp(rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, tampered), {
    store,
    sharedSecret: SECRET,
    publicUrl: ORIGIN,
    now,
    jwksUrl,
    jwksKeys: keys,
  });
  assert.equal(bad.status, 401);
  const badBody = (await bad.json()) as { error_description: string };
  assert.equal(badBody.error_description.includes("expired"), false);

  await store.banUser(userId, "test", null);
  const banned = await handleHttp(rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, token), {
    store,
    sharedSecret: SECRET,
    publicUrl: ORIGIN,
    now,
    jwksUrl,
    jwksKeys: keys,
  });
  assert.equal(banned.status, 401);
});

test("Neon session tokens and unknown passwords", async () => {
  const store = new MemoryStore();
  const userId = await seedUser(store, "session@example.com", "admin");
  store.addSession("neon-session-token", userId);
  const me = await tool(store, "neon-session-token", "get_current_user", {});
  assert.equal(me.method, "neon_session");
  assert.equal(me.admin, true);
  assert.equal(me.userId, userId);

  const missing = await verifyCredentials(store, "nobody@example.com", PASSWORD);
  assert.equal(missing, null);
});

test("OAuth authorization code, PKCE, refresh reuse, and tool calls", async () => {
  const store = new MemoryStore();
  const userId = await seedUser(store, "oauth@example.com", "user");
  const redirectUri = "http://127.0.0.1:9876/callback";
  const registered = await postJson("/register", {
    client_name: `<script>alert(1)</script>`,
    redirect_uris: [redirectUri],
  }, store);
  assert.equal(registered.status, 201);
  const client = (await registered.json()) as { client_id: string };
  const { verifier, challenge } = pkcePair();
  const resource = `${ORIGIN}/mcp`;
  const authorize = new URL(`${ORIGIN}/authorize`);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", client.client_id);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  authorize.searchParams.set("state", "state-1");
  authorize.searchParams.set("resource", resource);
  authorize.searchParams.set("scope", "tasks:read tasks:write users:read users:write");

  const page = await handleHttp(new Request(authorize), { store, publicUrl: ORIGIN });
  const html = await page.text();
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.equal(html.includes("<script>alert"), false);
  const requestId = /name="request_id" value="([^"]+)"/.exec(html)?.[1];
  assert.ok(requestId);

  const consented = await handleHttp(
    request("/authorize", "POST", new URLSearchParams({
      request_id: requestId,
      email: "oauth@example.com",
      password: PASSWORD,
    }).toString(), { "content-type": "application/x-www-form-urlencoded" }),
    { store, publicUrl: ORIGIN },
  );
  assert.equal(consented.status, 302);
  assert.equal(consented.headers.get("referrer-policy"), "no-referrer");
  const location = new URL(consented.headers.get("location") ?? "");
  const code = location.searchParams.get("code") ?? "";
  assert.equal(location.searchParams.get("state"), "state-1");

  const issued = await token(store, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: client.client_id,
    code_verifier: verifier,
    resource,
  });
  assert.equal(issued.status, 200);
  const tokens = (await issued.json()) as { access_token: string; refresh_token: string; scope: string };
  assert.equal(tokens.scope.includes("users:write"), false);
  const created = await tool(store, tokens.access_token, "create_item", { name: "Huevos", quantity: 6 });
  assert.equal(created.userId, userId);

  const refreshed = await token(store, {
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: client.client_id,
    resource,
  });
  assert.equal(refreshed.status, 200);
  const next = (await refreshed.json()) as { refresh_token: string };
  const reused = await token(store, {
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: client.client_id,
    resource,
  });
  assert.equal(reused.status, 400);
  const family = await token(store, {
    grant_type: "refresh_token",
    refresh_token: next.refresh_token,
    client_id: client.client_id,
    resource,
  });
  assert.equal(family.status, 400);
});

test("a bad PKCE verifier burns the authorization code", async () => {
  const store = new MemoryStore();
  await seedUser(store, "pkce@example.com", "user");
  const redirectUri = "http://localhost:9898/callback";
  const registered = await postJson("/register", { redirect_uris: [redirectUri] }, store);
  const client = (await registered.json()) as { client_id: string };
  const { challenge } = pkcePair();
  const authorize = new URL(`${ORIGIN}/authorize`);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", client.client_id);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  authorize.searchParams.set("state", "s");
  authorize.searchParams.set("resource", `${ORIGIN}/mcp`);
  const page = await handleHttp(new Request(authorize), { store, publicUrl: ORIGIN });
  const requestId = /name="request_id" value="([^"]+)"/.exec(await page.text())?.[1] ?? "";
  const consented = await handleHttp(
    request("/authorize", "POST", new URLSearchParams({
      request_id: requestId,
      email: "pkce@example.com",
      password: PASSWORD,
    }).toString(), { "content-type": "application/x-www-form-urlencoded" }),
    { store, publicUrl: ORIGIN },
  );
  const code = new URL(consented.headers.get("location") ?? "").searchParams.get("code") ?? "";
  const rejected = await token(store, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: client.client_id,
    code_verifier: "b".repeat(50),
    resource: `${ORIGIN}/mcp`,
  });
  assert.equal(rejected.status, 400);
  const retry = await token(store, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: client.client_id,
    code_verifier: "b".repeat(50),
    resource: `${ORIGIN}/mcp`,
  });
  assert.equal(retry.status, 400);
});

test("registration rejects a non-local http redirect", async () => {
  const response = await postJson("/register", { redirect_uris: ["http://evil.example/callback"] }, new MemoryStore());
  assert.equal(response.status, 400);
});

async function seedUser(store: MemoryStore, email: string, role: string): Promise<string> {
  const id = newId();
  await store.insertUser({
    id,
    name: email.split("@")[0] ?? "User",
    email,
    passwordHash: PASSWORD_HASH,
    role,
    emailVerified: true,
  });
  return id;
}

function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

function request(path: string, method: string, body?: string, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}${path}`, { method, headers, body });
}

function rpc(body: unknown, token?: string): Request {
  const headers: Record<string, string> = { accept: ACCEPT, "content-type": "application/json" };
  if (token) headers["authorization"] = `Bearer ${token}`;
  return request("/mcp", "POST", JSON.stringify(body), headers);
}

async function postJson(path: string, body: unknown, store: MemoryStore): Promise<Response> {
  return handleHttp(
    request(path, "POST", JSON.stringify(body), { "content-type": "application/json" }),
    { store, publicUrl: ORIGIN },
  );
}

async function token(store: MemoryStore, fields: Record<string, string>): Promise<Response> {
  return handleHttp(
    request("/token", "POST", new URLSearchParams(fields).toString(), {
      "content-type": "application/x-www-form-urlencoded",
    }),
    { store, publicUrl: ORIGIN },
  );
}

function signJwt(privateKey: ReturnType<typeof generateKeyPairSync>["privateKey"], payload: Record<string, unknown>, kid: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "EdDSA", kid, typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(null, Buffer.from(`${header}.${body}`), privateKey).toString("base64url");
  return `${header}.${body}.${signature}`;
}

async function tool(store: MemoryStore, bearer: string, name: string, args: Record<string, unknown>, options: Record<string, unknown> = {}): Promise<any> {
  const payload = await toolRaw(store, bearer, name, args, options);
  assert.equal(payload.result?.isError, undefined);
  return JSON.parse(payload.result.content[0].text);
}

async function toolRaw(store: MemoryStore, bearer: string, name: string, args: Record<string, unknown>, options: Record<string, unknown> = {}): Promise<any> {
  const response = await handleHttp(
    rpc({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, bearer),
    { store, sharedSecret: SECRET, publicUrl: ORIGIN, ...options },
  );
  assert.equal(response.status, 200);
  return response.json();
}
