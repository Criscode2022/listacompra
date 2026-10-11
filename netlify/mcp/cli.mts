import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { stdioPrincipal } from "./auth.mts";
import { loadDotEnv, readEnv } from "./env.mts";
import { createMcpServer, handleHttp } from "./http.mts";
import { NeonStore } from "./neon-store.mts";

const root = fileURLToPath(new URL("../..", import.meta.url));
loadDotEnv(resolve(root, ".env"));

const mode = process.argv[2] ?? "http";
if (mode === "stdio") {
  await serveStdio();
} else if (mode === "http") {
  await serveHttp();
} else {
  console.error("Usage: node --experimental-strip-types netlify/mcp/cli.mts [http|stdio]");
  process.exit(1);
}

async function serveStdio(): Promise<void> {
  const databaseUrl = readEnv("DATABASE_URL");
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  const store = new NeonStore(databaseUrl);
  await store.ensureSchema();
  const server = createMcpServer(store, stdioPrincipal());
  await server.connect(new StdioServerTransport());
}

async function serveHttp(): Promise<void> {
  const port = Number(readEnv("MCP_PORT") ?? readEnv("PORT") ?? "8787");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error("MCP_PORT must be a port number.");
    process.exit(1);
  }
  const server = createServer((req, res) => {
    void forward(req, res, port).catch((error: unknown) => {
      console.error(JSON.stringify({ mcp: "http", ok: false }));
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ error: "server_error" }));
      } else {
        res.end();
      }
      void error;
    });
  });
  server.listen(port, "127.0.0.1", () => {
    console.error(`listacompra MCP listening on http://127.0.0.1:${port}/mcp`);
  });
}

async function forward(req: IncomingMessage, res: ServerResponse, port: number): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const body = Buffer.concat(chunks);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined || key === "host" || key === "connection" || key === "content-length") continue;
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) headers.append(key, item);
  }
  const host = req.headers.host ?? `127.0.0.1:${port}`;
  const method = req.method ?? "GET";
  const request = new Request(`http://${host}${req.url ?? "/"}`, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : body,
  });
  const response = await handleHttp(request);
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  res.end(Buffer.from(await response.arrayBuffer()));
}
