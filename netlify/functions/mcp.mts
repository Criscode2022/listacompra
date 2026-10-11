import type { Config } from "@netlify/functions";
import { handleHttp } from "../mcp/http.mts";

export default function handler(request: Request): Promise<Response> {
  return handleHttp(request);
}

export const config: Config = {
  path: [
    "/mcp",
    "/register",
    "/authorize",
    "/token",
    "/revoke",
    "/.well-known/oauth-protected-resource",
    "/.well-known/oauth-protected-resource/mcp",
    "/.well-known/oauth-authorization-server",
    "/.well-known/oauth-authorization-server/mcp",
  ],
  rateLimit: {
    windowSize: 60,
    windowLimit: 120,
    aggregateBy: ["ip", "domain"],
  },
};
