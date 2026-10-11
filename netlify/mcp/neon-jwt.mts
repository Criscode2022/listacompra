import { createPublicKey, verify, type KeyObject } from "node:crypto";
import { readEnv } from "./env.mts";

// Neon Auth gives the app a short EdDSA JWT. The session row stores a different
// opaque token, so a pasted JWT never matches that row. The signature is checked
// against NEON_AUTH_JWKS_URL, and the subject must be a user in neon_auth.

const CACHE_MS = 10 * 60 * 1000;
const SKEW_SECONDS = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface NeonJwk {
  kid?: string;
  kty?: string;
  crv?: string;
  x?: string;
}

export interface JwtCheck {
  now?: number;
  jwksUrl?: string;
  keys?: NeonJwk[];
  fetchImpl?: typeof fetch;
}

export type JwtVerdict =
  | { ok: true; userId: string }
  | { ok: false; reason: "skip" | "malformed" | "bad_signature" | "expired" | "claims" | "unavailable" };

let cache: { url: string; at: number; keys: NeonJwk[] } | null = null;

export function configuredJwksUrl(override?: string): string | undefined {
  const raw = (override ?? readEnv("NEON_AUTH_JWKS_URL") ?? "").trim();
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" || url.username || url.password) return undefined;
  return url.toString();
}

export async function verifyNeonJwt(token: string, options: JwtCheck = {}): Promise<JwtVerdict> {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "skip" };
  const jwksUrl = configuredJwksUrl(options.jwksUrl);
  if (!jwksUrl && !options.keys?.length) return { ok: false, reason: "skip" };
  let header: { alg?: string; kid?: string };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (header.alg !== "EdDSA" || typeof header.kid !== "string" || !header.kid) {
    return { ok: false, reason: "malformed" };
  }
  const origin = jwksUrl ? new URL(jwksUrl).origin : "";
  if (!origin || !issuerAllowed(payload.iss, jwksUrl || "") || !audienceAllowed(payload.aud, jwksUrl || "")) {
    return { ok: false, reason: "claims" };
  }
  const userId = payload.sub;
  if (typeof userId !== "string" || !UUID.test(userId)) return { ok: false, reason: "claims" };
  let key: KeyObject | null;
  try {
    key = await keyFor(jwksUrl || "", header.kid, options);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (!key) return { ok: false, reason: "bad_signature" };
  const signature = Buffer.from(parts[2], "base64url");
  let signed = false;
  try {
    signed = verify(null, Buffer.from(`${parts[0]}.${parts[1]}`), key, signature);
  } catch {
    signed = false;
  }
  if (!signed) return { ok: false, reason: "bad_signature" };
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const exp = payload.exp;
  if (typeof exp !== "number" || exp + SKEW_SECONDS < now) return { ok: false, reason: "expired" };
  if (typeof payload.nbf === "number" && payload.nbf - SKEW_SECONDS > now) return { ok: false, reason: "claims" };
  return { ok: true, userId };
}

function issuerAllowed(iss: unknown, jwksUrl: string): boolean {
  if (typeof iss !== "string" || !jwksUrl) return false;
  const url = new URL(jwksUrl);
  const base = jwksUrl.replace(/\/\.well-known\/jwks\.json$/, "").replace(/\/$/, "");
  return iss === url.origin || iss === base;
}

function audienceAllowed(aud: unknown, jwksUrl: string): boolean {
  if (!jwksUrl) return false;
  const url = new URL(jwksUrl);
  const base = jwksUrl.replace(/\/\.well-known\/jwks\.json$/, "").replace(/\/$/, "");
  const allowed = new Set([url.origin, base]);
  const list = Array.isArray(aud) ? aud : [aud];
  return list.some((item) => typeof item === "string" && allowed.has(item.replace(/\/$/, "")));
}

async function keyFor(jwksUrl: string, kid: string, options: JwtCheck): Promise<KeyObject | null> {
  const keys = options.keys?.length ? options.keys : await loadKeys(jwksUrl, options.fetchImpl ?? fetch, kid);
  const jwk = keys.find((item) => item.kid === kid && item.kty === "OKP" && item.crv === "Ed25519" && item.x);
  if (!jwk?.x) return null;
  return createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: jwk.x }, format: "jwk" });
}

async function loadKeys(url: string, fetchImpl: typeof fetch, kid: string): Promise<NeonJwk[]> {
  const now = Date.now();
  if (cache && cache.url === url && now - cache.at < CACHE_MS && cache.keys.some((item) => item.kid === kid)) {
    return cache.keys;
  }
  const response = await fetchImpl(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("jwks");
  const text = await response.text();
  if (text.length > 65_536) throw new Error("jwks");
  const parsed = JSON.parse(text) as { keys?: NeonJwk[] };
  const keys = Array.isArray(parsed.keys) ? parsed.keys : [];
  cache = { url, at: now, keys };
  return keys;
}
