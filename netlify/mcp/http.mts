import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { resolvePrincipal, stdioPrincipal } from "./auth.mts";
import { canonicalResource, publicOriginFromRequest, type Principal } from "./domain.mts";
import { readEnv } from "./env.mts";
import { NeonStore } from "./neon-store.mts";
import { handleOAuth } from "./oauth.mts";
import type { Store } from "./store.mts";
import { buildServer } from "./tools.mts";

export interface HttpOptions {
  store?: Store;
  sharedSecret?: string;
  publicUrl?: string;
  stdio?: boolean;
  now?: number;
  jwksUrl?: string;
  jwksKeys?: import("./neon-jwt.mts").NeonJwk[];
}

const ready = new WeakMap<Store, Promise<void>>();

let defaultStore: Store | null = null;

export async function handleHttp(request: Request, options: HttpOptions = {}): Promise<Response> {
  if (request.method === "OPTIONS") return withCors(new Response(null, { status: 204 }));

  let store: Store;
  try {
    store = options.store ?? getDefaultStore();
  } catch (error) {
    return databaseError(error);
  }
  try {
    await prepare(store);
  } catch (error) {
    return databaseError(error);
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path !== "/mcp") {
    return withCors(await handleOAuth(request, store, options.publicUrl ?? readEnv("MCP_PUBLIC_URL")));
  }
  if (request.method === "DELETE") return withCors(new Response(null, { status: 204 }));
  if (request.method !== "POST") {
    return withCors(
      json({ error: "method_not_allowed", error_description: "This MCP server accepts POST only." }, 405, {
        allow: "POST",
      }),
    );
  }

  const sharedSecret = options.sharedSecret ?? readEnv("MCP_BEARER_TOKEN");
  const auth = options.stdio
    ? { principal: stdioPrincipal() }
    : await resolvePrincipal(store, request, sharedSecret, {
        now: options.now,
        jwksUrl: options.jwksUrl,
        keys: options.jwksKeys,
      });
  if (!auth.principal) {
    const origin = publicOriginFromRequest(request, options.publicUrl ?? readEnv("MCP_PUBLIC_URL"));
    return withCors(unauthorized(origin, auth.errorDescription));
  }

  const server = buildServer(store, auth.principal);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  const response = await transport.handleRequest(request);
  await server.close();
  return withCors(response);
}

export function createMcpServer(store: Store, principal: Principal): McpServer {
  return buildServer(store, principal);
}

function getDefaultStore(): Store {
  if (!defaultStore) {
    const databaseUrl = readEnv("DATABASE_URL");
    if (!databaseUrl) throw new Error("DATABASE_URL is not set.");
    defaultStore = new NeonStore(databaseUrl);
  }
  return defaultStore;
}

function databaseError(error: unknown): Response {
  const missing = error instanceof Error && error.message === "DATABASE_URL is not set.";
  console.error(
    JSON.stringify({ mcp: "schema", ok: false, reason: missing ? "missing_database_url" : "setup_failed" }),
  );
  return withCors(
    json(
      {
        error: "server_error",
        error_description: missing
          ? "DATABASE_URL is not set."
          : "The server could not prepare its database.",
      },
      500,
    ),
  );
}

function prepare(store: Store): Promise<void> {
  const pending = ready.get(store);
  if (pending) return pending;
  const next = store.ensureSchema().catch((error: unknown) => {
    ready.delete(store);
    throw error;
  });
  ready.set(store, next);
  return next;
}

function unauthorized(origin: string, description?: string): Response {
  const metadata = `${origin}/.well-known/oauth-protected-resource`;
  return json(
    {
      error: "unauthorized",
      error_description: description || "Send Authorization: Bearer with an OAuth access token, an lc_ API key, a Neon Auth session token, or the operator token.",
      resource: canonicalResource(origin),
    },
    401,
    {
      "www-authenticate": `Bearer realm="listacompra", error="invalid_token", resource_metadata="${metadata}"`,
    },
  );
}

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...extra },
  });
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  const origin = readEnv("MCP_ALLOWED_ORIGIN") ?? "*";
  headers.set("access-control-allow-origin", origin);
  if (origin !== "*") headers.append("vary", "Origin");
  headers.set("access-control-allow-methods", "GET, POST, DELETE, OPTIONS");
  headers.set(
    "access-control-allow-headers",
    "Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID, X-Api-Key",
  );
  headers.set("access-control-expose-headers", "WWW-Authenticate, MCP-Protocol-Version, Mcp-Session-Id");
  headers.set("access-control-max-age", "86400");
  headers.set("x-content-type-options", "nosniff");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
