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
import type { Store } from "./store.mts";

export async function resolvePrincipal(
  store: Store,
  request: Request,
  sharedSecret: string | undefined,
): Promise<Principal | null> {
  const token = bearerToken(request);
  if (!token) return null;
  if (sharedSecret && safeEqual(token, sharedSecret)) {
    return {
      method: "shared_secret",
      userId: null,
      email: null,
      name: null,
      admin: true,
      scopes: [...ADMIN_SCOPES],
    };
  }
  if (token.startsWith("lc_")) {
    const found = await store.findActiveApiKey(sha256(token));
    if (!found || isBanned(found.user)) return null;
    return {
      method: "api_key",
      userId: found.user.id,
      email: found.user.email,
      name: found.user.name,
      admin: isAdminRole(found.user.role),
      scopes: found.key.scopes,
      apiKeyId: found.key.id,
    };
  }
  if (token.startsWith("ola_")) {
    const found = await store.findAccessToken(sha256(token));
    if (!found || isBanned(found.user)) return null;
    return principalFromUser(found.user, "oauth", found.scopes);
  }
  const sessionUser = await store.findSessionUser(token, sha256(token));
  if (!sessionUser || isBanned(sessionUser)) return null;
  return principalFromUser(sessionUser, "neon_session", scopesForUser(isAdminRole(sessionUser.role)));
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
