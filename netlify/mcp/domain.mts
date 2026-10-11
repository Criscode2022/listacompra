import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const SERVER_NAME = "listacompra";
export const SERVER_VERSION = "1.0.0";

export const UNITS = ["ud", "kg", "g", "l", "ml", "oz", "lb"] as const;
export const CATEGORIES = [
  "frutas",
  "verduras",
  "carnes",
  "pescados",
  "lácteos",
  "panadería",
  "bebidas",
  "limpieza",
  "higiene",
  "congelados",
  "otros",
] as const;

export const TASK_VIEWS = ["all", "lista", "despensa", "urgente"] as const;

export const SCOPES = [
  "tasks:read",
  "tasks:write",
  "users:read",
  "users:write",
] as const;

export type Unit = (typeof UNITS)[number];
export type Category = (typeof CATEGORIES)[number];
export type TaskView = (typeof TASK_VIEWS)[number];
export type Scope = (typeof SCOPES)[number];
export type AuthMethod =
  | "shared_secret"
  | "api_key"
  | "oauth"
  | "neon_session"
  | "stdio";

export const USER_SCOPES: Scope[] = ["tasks:read", "tasks:write", "users:read"];
export const ADMIN_SCOPES: Scope[] = [...SCOPES];

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
export const AUTH_CODE_TTL_SECONDS = 60 * 10;

const SCOPE_SET = new Set<string>(SCOPES);

export interface Principal {
  method: AuthMethod;
  userId: string | null;
  email: string | null;
  name: string | null;
  admin: boolean;
  scopes: Scope[];
  apiKeyId?: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: string | null;
  banned: boolean;
  banReason: string | null;
  banExpires: string | null;
  createdAt: string;
  updatedAt: string;
  basicMode?: boolean;
}

export interface ShoppingTask {
  userId: string;
  name: string;
  checked: boolean;
  quantity: number;
  urgent: boolean;
  unit: Unit;
  category: Category;
  createdAt: string;
  updatedAt: string;
}

export class ServiceError extends Error {
  readonly code: "forbidden" | "not_found" | "conflict" | "bad_request";

  constructor(message: string, code: "forbidden" | "not_found" | "conflict" | "bad_request") {
    super(message);
    this.name = "ServiceError";
    this.code = code;
  }
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(prefix: string, bytes = 32): string {
  return `${prefix}${randomBytes(bytes).toString("base64url")}`;
}

export function isScope(value: string): value is Scope {
  return SCOPE_SET.has(value);
}

export function parseScopes(value: string | null | undefined): Scope[] {
  if (!value?.trim()) return [];
  const seen = new Set<Scope>();
  for (const part of value.split(/[\s,]+/)) {
    if (!part) continue;
    if (!isScope(part)) {
      throw new ServiceError(`Unknown scope: ${part}`, "bad_request");
    }
    seen.add(part);
  }
  return [...seen];
}

export function formatScopes(scopes: readonly Scope[]): string {
  return scopes.join(" ");
}

export function scopesForUser(admin: boolean): Scope[] {
  return admin ? [...ADMIN_SCOPES] : [...USER_SCOPES];
}

export function hasScope(principal: Principal, scope: Scope): boolean {
  return principal.scopes.includes(scope);
}

export function isAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return role
    .split(",")
    .map((part) => part.trim())
    .includes("admin");
}

export function isBanned(user: Pick<PublicUser, "banned" | "banExpires">): boolean {
  if (!user.banned) return false;
  if (!user.banExpires) return true;
  return new Date(user.banExpires).getTime() > Date.now();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function assertEmail(email: string): string {
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 200) {
    throw new ServiceError("Enter a valid email address.", "bad_request");
  }
  return normalized;
}

export function assertPersonName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 80) {
    throw new ServiceError("Name must be between 1 and 80 characters.", "bad_request");
  }
  return trimmed;
}

export function assertPassword(password: string): string {
  if (password.length < 8 || password.length > 128) {
    throw new ServiceError("Password must be between 8 and 128 characters.", "bad_request");
  }
  return password;
}

export function assertProductName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 200) {
    throw new ServiceError(
      "Product name must be between 1 and 200 characters. The name is the item's identity.",
      "bad_request",
    );
  }
  return trimmed;
}

export function assertQuantity(quantity: number): number {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
    throw new ServiceError("Quantity must be a whole number from 1 to 999.", "bad_request");
  }
  return quantity;
}

export function assertUnit(unit: string): Unit {
  if (!(UNITS as readonly string[]).includes(unit)) {
    throw new ServiceError(`Unit must be one of: ${UNITS.join(", ")}.`, "bad_request");
  }
  return unit as Unit;
}

export function assertCategory(category: string): Category {
  if (!(CATEGORIES as readonly string[]).includes(category)) {
    throw new ServiceError(
      `Category must be one of: ${CATEGORIES.join(", ")}.`,
      "bad_request",
    );
  }
  return category as Category;
}

export function assertLimit(limit: number | undefined, fallback = 50): number {
  const value = limit ?? fallback;
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new ServiceError("Limit must be a whole number from 1 to 100.", "bad_request");
  }
  return value;
}

export function assertOffset(offset: number | undefined): number {
  const value = offset ?? 0;
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new ServiceError("Offset must be a whole number from 0 to 10000.", "bad_request");
  }
  return value;
}

export function targetUserId(principal: Principal, requested?: string): string {
  if (requested && requested !== principal.userId) {
    if (!principal.admin) {
      throw new ServiceError(
        "Only an admin can act on another user's shopping list.",
        "forbidden",
      );
    }
    return requested;
  }
  if (principal.userId) return principal.userId;
  throw new ServiceError(
    "user_id is required when the caller is the shared operator token or a local stdio process.",
    "bad_request",
  );
}

export function requireScope(principal: Principal, scope: Scope): void {
  if (!hasScope(principal, scope)) {
    throw new ServiceError(`Missing scope ${scope}.`, "forbidden");
  }
}

export function requireAdmin(principal: Principal): void {
  if (!principal.admin) {
    throw new ServiceError("This action requires an admin.", "forbidden");
  }
}

export function verifyPkce(verifier: string, challenge: string): boolean {
  if (verifier.length < 43 || verifier.length > 128) return false;
  if (!/^[-A-Za-z0-9._~]+$/.test(verifier)) return false;
  const digest = createHash("sha256").update(verifier).digest("base64url");
  return safeEqual(digest, challenge);
}

export function isAllowedRedirect(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.username || url.password || url.hash) return false;
  if (url.protocol === "https:") return true;
  if (url.protocol !== "http:") return false;
  return url.hostname === "localhost" || url.hostname === "127.0.0.1";
}

export function canonicalResource(publicOrigin: string): string {
  return `${publicOrigin.replace(/\/+$/, "")}/mcp`;
}

export function resourceMatches(resource: string, publicOrigin: string): boolean {
  let url: URL;
  try {
    url = new URL(resource);
  } catch {
    return false;
  }
  if (url.username || url.password || url.hash || url.search) return false;
  const expected = new URL(canonicalResource(publicOrigin));
  if (url.protocol !== expected.protocol) return false;
  if (url.host.toLowerCase() !== expected.host.toLowerCase()) return false;
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return path === "/mcp";
}

export function appendQuery(uri: string, params: Record<string, string>): string {
  const url = new URL(uri);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

export function publicOriginFromRequest(request: Request, configured?: string): string {
  if (configured) return configured.replace(/\/+$/, "");
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || url.host;
  const proto = forwardedProto || url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(\S+)\s*$/i);
  if (match?.[1]) return match[1];
  const apiKey = request.headers.get("x-api-key")?.trim();
  return apiKey || null;
}

export function basicCredentials(
  request: Request,
): { clientId: string; clientSecret: string } | null {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Basic\s+(\S+)\s*$/i);
  if (!match?.[1]) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(match[1], "base64").toString("utf8");
  } catch {
    return null;
  }
  const separator = decoded.indexOf(":");
  if (separator < 0) return null;
  try {
    return {
      clientId: decodeURIComponent(decoded.slice(0, separator)),
      clientSecret: decodeURIComponent(decoded.slice(separator + 1)),
    };
  } catch {
    return null;
  }
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function ilikePattern(query: string): string {
  const escaped = query.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
  return `%${escaped}%`;
}

export function iso(value: Date | string): string {
  return new Date(value).toISOString();
}
