import {
  ADMIN_SCOPES,
  bearerToken,
  isAdminRole,
  isBanned,
  safeEqual,
  scopesForUser,
  sha256,
  type Principal,
  type Scope,
} from "./domain.mts";
import { verifyNeonJwt, type JwtCheck } from "./neon-jwt.mts";
import type { Store } from "./store.mts";

export interface AuthResult {
  principal: Principal | null;
  errorDescription?: string;
}

export async function resolvePrincipal(
  store: Store,
  request: Request,
  sharedSecret: string | undefined,
  jwt: JwtCheck = {},
): Promise<AuthResult> {
  const token = bearerToken(request);
  if (!token) return { principal: null };
  if (sharedSecret && safeEqual(token, sharedSecret)) {
    return {
      principal: {
        method: "shared_secret",
        userId: null,
        email: null,
        name: null,
        admin: true,
        scopes: [...ADMIN_SCOPES],
      },
    };
  }
  if (token.startsWith("lc_")) {
    const found = await store.findActiveApiKey(sha256(token));
    if (!found || isBanned(found.user)) return { principal: null };
    return {
      principal: {
        method: "api_key",
        userId: found.user.id,
        email: found.user.email,
        name: found.user.name,
        admin: isAdminRole(found.user.role),
        scopes: found.key.scopes,
        apiKeyId: found.key.id,
      },
    };
  }
  if (token.startsWith("ola_")) {
    const found = await store.findAccessToken(sha256(token));
    if (!found || isBanned(found.user)) return { principal: null };
    return { principal: principalFromUser(found.user, "oauth", found.scopes) };
  }
  const sessionUser = await store.findSessionUser(token, sha256(token));
  if (sessionUser && !isBanned(sessionUser)) {
    return { principal: principalFromUser(sessionUser, "neon_session", scopesForUser(isAdminRole(sessionUser.role))) };
  }
  const verdict = await verifyNeonJwt(token, jwt);
  if (verdict.ok) {
    const user = await store.getUserById(verdict.userId);
    if (!user || isBanned(user)) return { principal: null };
    return { principal: principalFromUser(user, "neon_session", scopesForUser(isAdminRole(user.role))) };
  }
  if (verdict.reason === "expired") {
    return {
      principal: null,
      errorDescription: "This Neon Auth token has expired. Sign in again and paste the new token. It only lasts a few minutes.",
    };
  }
  if (verdict.reason === "unavailable") {
    return { principal: null, errorDescription: "The server could not read the Neon Auth signing keys." };
  }
  return { principal: null };
}

function principalFromUser(
  user: { id: string; email: string; name: string; role: string | null },
  method: Principal["method"],
  scopes: Scope[],
): Principal {
  return {
    method,
    userId: user.id,
    email: user.email,
    name: user.name,
    admin: isAdminRole(user.role),
    scopes,
  };
}

export function stdioPrincipal(): Principal {
  return {
    method: "stdio",
    userId: null,
    email: null,
    name: null,
    admin: true,
    scopes: [...ADMIN_SCOPES],
  };
}
