import { hashPassword, verifyPassword } from "@better-auth/utils/password";
import { randomUUID } from "node:crypto";
import {
  assertCategory,
  assertEmail,
  assertLimit,
  assertOffset,
  assertPassword,
  assertPersonName,
  assertProductName,
  assertQuantity,
  assertUnit,
  isAdminRole,
  isBanned,
  randomToken,
  requireAdmin,
  requireScope,
  scopesForUser,
  sha256,
  targetUserId,
  type Category,
  type Principal,
  type PublicUser,
  type Scope,
  type ShoppingTask,
  type TaskView,
  type Unit,
  ServiceError,
} from "./domain.mts";
import type { ApiKeyRecord, Store, TaskPatch } from "./store.mts";

let dummyHash: Promise<string> | null = null;

function fakeHash(): Promise<string> {
  dummyHash ??= hashPassword("not-a-real-password");
  return dummyHash;
}

function uniqueOr(error: unknown, message: string): never {
  const code = typeof error === "object" && error && "code" in error ? error.code : undefined;
  const text = error instanceof Error ? error.message : "";
  if (code === "23505" || /duplicate|unique/i.test(text)) {
    throw new ServiceError(message, "conflict");
  }
  throw error;
}

export async function verifyCredentials(
  store: Store,
  email: string,
  password: string,
): Promise<PublicUser | null> {
  const user = await store.getUserByEmail(email);
  const hash = user ? await store.getPasswordHash(user.id) : null;
  const ok = await verifyPassword(hash ?? (await fakeHash()), password);
  if (!user || !hash || !ok || isBanned(user)) return null;
  return user;
}

export async function listUsers(
  store: Store,
  principal: Principal,
  input: { search?: string; limit?: number; offset?: number },
): Promise<{ users: PublicUser[]; total: number }> {
  requireScope(principal, "users:read");
  if (!principal.admin) {
    if (!principal.userId) return { users: [], total: 0 };
    const user = await store.getUserById(principal.userId);
    return { users: user ? [user] : [], total: user ? 1 : 0 };
  }
  return store.listUsers({
    search: input.search?.trim() || undefined,
    limit: assertLimit(input.limit),
    offset: assertOffset(input.offset),
  });
}

export async function getUser(
  store: Store,
  principal: Principal,
  input: { userId?: string; email?: string },
): Promise<PublicUser> {
  requireScope(principal, "users:read");
  const user = input.email
    ? await store.getUserByEmail(assertEmail(input.email))
    : await store.getUserById(input.userId ?? principal.userId ?? "");
  if (!user) throw new ServiceError("User not found.", "not_found");
  if (user.id !== principal.userId && !principal.admin) {
    throw new ServiceError("Only an admin can read another user.", "forbidden");
  }
  user.basicMode = await store.getBasicMode(user.id);
  return user;
}

export async function createUser(
  store: Store,
  principal: Principal,
  input: {
    name: string;
    email: string;
    password: string;
    role?: "user" | "admin";
    emailVerified?: boolean;
  },
): Promise<PublicUser> {
  requireScope(principal, "users:write");
  requireAdmin(principal);
  const role = input.role ?? "user";
  if (role !== "user" && role !== "admin") {
    throw new ServiceError("Role must be user or admin.", "bad_request");
  }
  try {
    return await store.insertUser({
      id: randomUUID(),
      name: assertPersonName(input.name),
      email: assertEmail(input.email),
      passwordHash: await hashPassword(assertPassword(input.password)),
      role,
      emailVerified: input.emailVerified ?? true,
    });
  } catch (error) {
    uniqueOr(error, "A user with that email already exists.");
  }
}

export async function updateUser(
  store: Store,
  principal: Principal,
  input: {
    userId?: string;
    name?: string;
    email?: string;
    role?: "user" | "admin" | null;
    emailVerified?: boolean;
    basicMode?: boolean;
  },
): Promise<PublicUser> {
  const userId = input.userId ?? principal.userId;
  if (!userId) {
    throw new ServiceError("user_id is required for the operator token.", "bad_request");
  }
  const self = userId === principal.userId;
  if (!self) {
    requireScope(principal, "users:write");
    requireAdmin(principal);
  }
  if ((input.email !== undefined || input.role !== undefined || input.emailVerified !== undefined) && !principal.admin) {
    throw new ServiceError("Only an admin can change email, role, or verification.", "forbidden");
  }
  if (input.role !== undefined && input.role !== null && input.role !== "user" && input.role !== "admin") {
    throw new ServiceError("Role must be user or admin.", "bad_request");
  }
  try {
    const user = await store.updateUser(userId, {
      name: input.name === undefined ? undefined : assertPersonName(input.name),
      email: input.email === undefined ? undefined : assertEmail(input.email),
      role: input.role,
      emailVerified: input.email === undefined ? input.emailVerified : (input.emailVerified ?? false),
      basicMode: input.basicMode,
    });
    if (!user) throw new ServiceError("User not found.", "not_found");
    return user;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    uniqueOr(error, "A user with that email already exists.");
  }
}

export async function setUserPassword(
  store: Store,
  principal: Principal,
  input: { userId?: string; newPassword: string; currentPassword?: string },
): Promise<{ userId: string; changed: true }> {
  const userId = input.userId ?? principal.userId;
  if (!userId) {
    throw new ServiceError("user_id is required for the operator token.", "bad_request");
  }
  const self = userId === principal.userId;
  if (!self) {
    requireScope(principal, "users:write");
    requireAdmin(principal);
  } else if (!input.currentPassword) {
    throw new ServiceError("current_password is required to change your own password.", "bad_request");
  } else {
    const user = await store.getUserById(userId);
    if (!user) throw new ServiceError("User not found.", "not_found");
    const verified = await verifyCredentials(store, user.email, input.currentPassword);
    if (!verified) throw new ServiceError("Current password is wrong.", "forbidden");
  }
  const changed = await store.setPasswordHash(userId, await hashPassword(assertPassword(input.newPassword)));
  if (!changed) throw new ServiceError("User not found.", "not_found");
  return { userId, changed: true };
}

export async function banUser(
  store: Store,
  principal: Principal,
  input: { userId: string; reason?: string; expiresInSeconds?: number },
): Promise<PublicUser> {
  requireScope(principal, "users:write");
  requireAdmin(principal);
  if (input.userId === principal.userId) {
    throw new ServiceError("Refusing to ban the signed-in account.", "bad_request");
  }
  const expires =
    input.expiresInSeconds === undefined
      ? null
      : new Date(Date.now() + assertBanSeconds(input.expiresInSeconds) * 1000).toISOString();
  const user = await store.banUser(input.userId, input.reason?.trim() || null, expires);
  if (!user) throw new ServiceError("User not found.", "not_found");
  return user;
}

export async function unbanUser(
  store: Store,
  principal: Principal,
  userId: string,
): Promise<PublicUser> {
  requireScope(principal, "users:write");
  requireAdmin(principal);
  const user = await store.unbanUser(userId);
  if (!user) throw new ServiceError("User not found.", "not_found");
  return user;
}

export async function deleteUser(
  store: Store,
  principal: Principal,
  userId: string,
): Promise<{ deleted: true; userId: string }> {
  requireScope(principal, "users:write");
  requireAdmin(principal);
  if (userId === principal.userId) {
    throw new ServiceError("Refusing to delete the signed-in account.", "bad_request");
  }
  const deleted = await store.deleteUser(userId);
  if (!deleted) throw new ServiceError("User not found.", "not_found");
  return { deleted: true, userId };
}

export async function listTasks(
  store: Store,
  principal: Principal,
  input: {
    userId?: string;
    view?: TaskView;
    category?: Category;
    query?: string;
    checked?: boolean;
    limit?: number;
    offset?: number;
  },
): Promise<{ tasks: ShoppingTask[]; total: number }> {
  requireScope(principal, "tasks:read");
  return store.listTasks({
    userId: targetUserId(principal, input.userId),
    view: input.view ?? "all",
    category: input.category,
    query: input.query?.trim() || undefined,
    checked: input.checked,
    limit: assertLimit(input.limit),
    offset: assertOffset(input.offset),
  });
}

export async function getTask(
  store: Store,
  principal: Principal,
  input: { name: string; userId?: string },
): Promise<ShoppingTask> {
  requireScope(principal, "tasks:read");
  const task = await store.getTask(targetUserId(principal, input.userId), assertProductName(input.name));
  if (!task) throw new ServiceError("Task not found.", "not_found");
  return task;
}

export async function createTask(
  store: Store,
  principal: Principal,
  input: {
    name: string;
    userId?: string;
    quantity?: number;
    unit?: string;
    category?: string;
    urgent?: boolean;
    checked?: boolean;
  },
): Promise<ShoppingTask> {
  requireScope(principal, "tasks:write");
  try {
    return await store.insertTask({
      userId: targetUserId(principal, input.userId),
      name: assertProductName(input.name),
      quantity: assertQuantity(input.quantity ?? 1),
      unit: assertUnit(input.unit ?? "ud"),
      category: assertCategory(input.category ?? "otros"),
      urgent: input.urgent ?? false,
      checked: input.checked ?? false,
    });
  } catch (error) {
    uniqueOr(error, "A shopping item with that name already exists for this user.");
  }
}

export async function updateTask(
  store: Store,
  principal: Principal,
  input: {
    name: string;
    userId?: string;
    newName?: string;
    quantity?: number;
    unit?: Unit;
    category?: Category;
    urgent?: boolean;
    checked?: boolean;
  },
): Promise<ShoppingTask> {
  requireScope(principal, "tasks:write");
  const patch: TaskPatch = {};
  if (input.newName !== undefined) patch.name = assertProductName(input.newName);
  if (input.quantity !== undefined) patch.quantity = assertQuantity(input.quantity);
  if (input.unit !== undefined) patch.unit = assertUnit(input.unit);
  if (input.category !== undefined) patch.category = assertCategory(input.category);
  if (input.urgent !== undefined) patch.urgent = input.urgent;
  if (input.checked !== undefined) patch.checked = input.checked;
  try {
    const task = await store.updateTask(
      targetUserId(principal, input.userId),
      assertProductName(input.name),
      patch,
    );
    if (!task) throw new ServiceError("Task not found.", "not_found");
    return task;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    uniqueOr(error, "A shopping item with that name already exists for this user.");
  }
}

export async function deleteTask(
  store: Store,
  principal: Principal,
  input: { name: string; userId?: string },
): Promise<{ deleted: true; name: string }> {
  requireScope(principal, "tasks:write");
  const name = assertProductName(input.name);
  const deleted = await store.deleteTask(targetUserId(principal, input.userId), name);
  if (!deleted) throw new ServiceError("Task not found.", "not_found");
  return { deleted: true, name };
}

export async function createApiKey(
  store: Store,
  principal: Principal,
  input: { label: string; scopes?: Scope[]; userId?: string },
): Promise<{ apiKey: string; key: ApiKeyRecord }> {
  const userId = input.userId ?? principal.userId;
  if (!userId) {
    throw new ServiceError("user_id is required for the operator token.", "bad_request");
  }
  if (userId !== principal.userId) {
    requireAdmin(principal);
    requireScope(principal, "users:write");
  }
  const user = await store.getUserById(userId);
  if (!user) throw new ServiceError("User not found.", "not_found");
  if (isBanned(user)) throw new ServiceError("Cannot mint a key for a banned user.", "forbidden");
  const label = input.label.trim();
  if (!label || label.length > 80) {
    throw new ServiceError("Label must be between 1 and 80 characters.", "bad_request");
  }
  const ceiling = scopesForUser(isAdminRole(user.role));
  const requested = input.scopes ?? ceiling.filter((scope) => principal.scopes.includes(scope));
  if (requested.length === 0) {
    throw new ServiceError("Choose at least one scope.", "bad_request");
  }
  for (const scope of requested) {
    if (!principal.scopes.includes(scope) || !ceiling.includes(scope)) {
      throw new ServiceError(`Cannot grant scope ${scope}.`, "forbidden");
    }
  }
  const apiKey = randomToken("lc_");
  const record: ApiKeyRecord = {
    id: randomUUID(),
    userId,
    label,
    prefix: apiKey.slice(0, 11),
    scopes: requested,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    revokedAt: null,
  };
  await store.insertApiKey(record, sha256(apiKey));
  return { apiKey, key: record };
}

export async function listApiKeys(
  store: Store,
  principal: Principal,
  userId?: string,
): Promise<ApiKeyRecord[]> {
  const owner = userId ?? principal.userId;
  if (!owner) throw new ServiceError("user_id is required for the operator token.", "bad_request");
  if (owner !== principal.userId) requireAdmin(principal);
  return store.listApiKeys(owner);
}

export async function revokeApiKey(
  store: Store,
  principal: Principal,
  input: { id: string; userId?: string },
): Promise<{ revoked: true; id: string }> {
  const owner = input.userId ?? principal.userId;
  if (!owner) throw new ServiceError("user_id is required for the operator token.", "bad_request");
  if (owner !== principal.userId) requireAdmin(principal);
  const revoked = await store.revokeApiKey(input.id, owner);
  if (!revoked) throw new ServiceError("API key not found.", "not_found");
  return { revoked: true, id: input.id };
}

export function currentPrincipal(principal: Principal): {
  method: Principal["method"];
  userId: string | null;
  email: string | null;
  name: string | null;
  admin: boolean;
  scopes: Scope[];
  apiKeyId?: string;
} {
  return {
    method: principal.method,
    userId: principal.userId,
    email: principal.email,
    name: principal.name,
    admin: principal.admin,
    scopes: principal.scopes,
    apiKeyId: principal.apiKeyId,
  };
}

function assertBanSeconds(value: number): number {
  if (!Number.isInteger(value) || value < 60 || value > 60 * 60 * 24 * 365) {
    throw new ServiceError(
      "expires_in_seconds must be a whole number from 60 to 31536000.",
      "bad_request",
    );
  }
  return value;
}
