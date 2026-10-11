import { randomUUID } from "node:crypto";
import {
  isBanned,
  iso,
  normalizeEmail,
  type PublicUser,
  type ShoppingTask,
} from "./domain.mts";
import type {
  ApiKeyRecord,
  AuthCodeRecord,
  AuthRequestRecord,
  ListTasksQuery,
  ListUsersQuery,
  NewTask,
  NewUser,
  Store,
  StoredClient,
  TaskPatch,
  TokenRecord,
  UserPatch,
} from "./store.mts";

interface MemoryUser extends PublicUser {
  passwordHash: string | null;
}

interface MemoryCode extends AuthCodeRecord {
  expiresAt: number;
  used: boolean;
}

interface MemoryToken extends TokenRecord {
  kind: "access" | "refresh";
  expiresAt: number;
  rotatedAt: number | null;
}

function taskMatches(task: ShoppingTask, query: ListTasksQuery): boolean {
  if (task.userId !== query.userId) return false;
  if (query.view === "lista" && (task.checked || task.urgent)) return false;
  if (query.view === "despensa" && task.urgent) return false;
  if (query.view === "urgente" && !task.urgent) return false;
  if (query.category && task.category !== query.category) return false;
  if (query.checked !== undefined && task.checked !== query.checked) return false;
  if (query.query && !task.name.toLowerCase().includes(query.query.toLowerCase())) return false;
  return true;
}

export class MemoryStore implements Store {
  readonly users = new Map<string, MemoryUser>();
  readonly tasks: ShoppingTask[] = [];
  readonly clients = new Map<string, StoredClient>();
  readonly authRequests = new Map<string, AuthRequestRecord>();
  readonly codes = new Map<string, MemoryCode>();
  readonly tokens = new Map<string, MemoryToken>();
  readonly apiKeys = new Map<string, ApiKeyRecord & { keyHash: string }>();
  readonly sessions = new Map<string, string>();

  async ensureSchema(): Promise<void> {}

  async listUsers(query: ListUsersQuery): Promise<{ users: PublicUser[]; total: number }> {
    let users = [...this.users.values()].map((user) => publicUser(user));
    if (query.search) {
      const search = query.search.toLowerCase();
      users = users.filter(
        (user) =>
          user.email.toLowerCase().includes(search) ||
          user.name.toLowerCase().includes(search),
      );
    }
    users.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { total: users.length, users: users.slice(query.offset, query.offset + query.limit) };
  }

  async getUserById(id: string): Promise<PublicUser | null> {
    const user = this.users.get(id);
    return user ? publicUser(user) : null;
  }

  async getUserByEmail(email: string): Promise<PublicUser | null> {
    const normalized = normalizeEmail(email);
    for (const user of this.users.values()) {
      if (user.email === normalized) return publicUser(user);
    }
    return null;
  }

  async getPasswordHash(userId: string): Promise<string | null> {
    return this.users.get(userId)?.passwordHash ?? null;
  }

  async insertUser(input: NewUser): Promise<PublicUser> {
    if ([...this.users.values()].some((user) => user.email === input.email)) {
      throw Object.assign(new Error("duplicate email"), { code: "23505" });
    }
    const now = new Date().toISOString();
    const user: MemoryUser = {
      id: input.id,
      name: input.name,
      email: input.email,
      emailVerified: input.emailVerified,
      role: input.role,
      banned: false,
      banReason: null,
      banExpires: null,
      createdAt: now,
      updatedAt: now,
      basicMode: false,
      passwordHash: input.passwordHash,
    };
    this.users.set(user.id, user);
    return publicUser(user);
  }

  async updateUser(id: string, patch: UserPatch): Promise<PublicUser | null> {
    const user = this.users.get(id);
    if (!user) return null;
    if (patch.email && [...this.users.values()].some((row) => row.email === patch.email && row.id !== id)) {
      throw Object.assign(new Error("duplicate email"), { code: "23505" });
    }
    if (patch.name !== undefined) user.name = patch.name;
    if (patch.email !== undefined) user.email = patch.email;
    if (patch.role !== undefined) user.role = patch.role;
    if (patch.emailVerified !== undefined) user.emailVerified = patch.emailVerified;
    if (patch.basicMode !== undefined) user.basicMode = patch.basicMode;
    user.updatedAt = new Date().toISOString();
    return publicUser(user);
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;
    user.passwordHash = passwordHash;
    user.updatedAt = new Date().toISOString();
    for (const [token, sessionUserId] of this.sessions) {
      if (sessionUserId === userId) this.sessions.delete(token);
    }
    for (const [hash, token] of this.tokens) {
      if (token.userId === userId) this.tokens.delete(hash);
    }
    return true;
  }

  async banUser(id: string, reason: string | null, banExpires: string | null): Promise<PublicUser | null> {
    const user = this.users.get(id);
    if (!user) return null;
    user.banned = true;
    user.banReason = reason;
    user.banExpires = banExpires;
    user.updatedAt = new Date().toISOString();
    this.revokeUserAccess(id);
    return publicUser(user);
  }

  async unbanUser(id: string): Promise<PublicUser | null> {
    const user = this.users.get(id);
    if (!user) return null;
    user.banned = false;
    user.banReason = null;
    user.banExpires = null;
    user.updatedAt = new Date().toISOString();
    return publicUser(user);
  }

  async deleteUser(id: string): Promise<boolean> {
    if (!this.users.delete(id)) return false;
    for (let index = this.tasks.length - 1; index >= 0; index -= 1) {
      const task = this.tasks[index];
      if (task?.userId === id) this.tasks.splice(index, 1);
    }
    this.revokeUserAccess(id);
    for (const [token, userId] of this.sessions) {
      if (userId === id) this.sessions.delete(token);
    }
    return true;
  }

  async findSessionUser(token: string, tokenHash: string): Promise<PublicUser | null> {
    const userId = this.sessions.get(token) ?? this.sessions.get(tokenHash);
    if (!userId) return null;
    const user = this.users.get(userId);
    if (!user || isBanned(user)) return null;
    return publicUser(user);
  }

  async listTasks(query: ListTasksQuery): Promise<{ tasks: ShoppingTask[]; total: number }> {
    const tasks = this.tasks
      .filter((task) => taskMatches(task, query))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { total: tasks.length, tasks: tasks.slice(query.offset, query.offset + query.limit) };
  }

  async getTask(userId: string, name: string): Promise<ShoppingTask | null> {
    return this.tasks.find((task) => task.userId === userId && task.name === name) ?? null;
  }

  async insertTask(task: NewTask): Promise<ShoppingTask> {
    if (await this.getTask(task.userId, task.name)) {
      throw Object.assign(new Error("duplicate task"), { code: "23505" });
    }
    const now = new Date().toISOString();
    const stored: ShoppingTask = { ...task, createdAt: now, updatedAt: now };
    this.tasks.push(stored);
    return stored;
  }

  async updateTask(userId: string, name: string, patch: TaskPatch): Promise<ShoppingTask | null> {
    const task = this.tasks.find((row) => row.userId === userId && row.name === name);
    if (!task) return null;
    if (patch.name && patch.name !== name && (await this.getTask(userId, patch.name))) {
      throw Object.assign(new Error("duplicate task"), { code: "23505" });
    }
    if (patch.name !== undefined) task.name = patch.name;
    if (patch.quantity !== undefined) task.quantity = patch.quantity;
    if (patch.unit !== undefined) task.unit = patch.unit;
    if (patch.category !== undefined) task.category = patch.category;
    if (patch.urgent !== undefined) task.urgent = patch.urgent;
    if (patch.checked !== undefined) task.checked = patch.checked;
    task.updatedAt = new Date().toISOString();
    return task;
  }

  async deleteTask(userId: string, name: string): Promise<boolean> {
    const index = this.tasks.findIndex((task) => task.userId === userId && task.name === name);
    if (index < 0) return false;
    this.tasks.splice(index, 1);
    return true;
  }

  async getBasicMode(userId: string): Promise<boolean> {
    return this.users.get(userId)?.basicMode ?? false;
  }

  async insertClient(client: StoredClient): Promise<void> {
    this.clients.set(client.id, client);
  }

  async getClient(id: string): Promise<StoredClient | null> {
    return this.clients.get(id) ?? null;
  }

  async insertAuthRequest(request: AuthRequestRecord): Promise<void> {
    this.authRequests.set(request.id, request);
  }

  async getAuthRequest(id: string): Promise<AuthRequestRecord | null> {
    const request = this.authRequests.get(id);
    if (!request || request.consumed || new Date(request.expiresAt).getTime() <= Date.now()) {
      return null;
    }
    return request;
  }

  async consumeAuthRequest(id: string): Promise<AuthRequestRecord | null> {
    const request = await this.getAuthRequest(id);
    if (!request) return null;
    request.consumed = true;
    return request;
  }

  async insertAuthCode(codeHash: string, code: AuthCodeRecord, expiresAt: string): Promise<void> {
    this.codes.set(codeHash, { ...code, expiresAt: new Date(expiresAt).getTime(), used: false });
  }

  async consumeAuthCode(codeHash: string): Promise<AuthCodeRecord | null> {
    const code = this.codes.get(codeHash);
    if (!code || code.used || code.expiresAt <= Date.now()) return null;
    code.used = true;
    return {
      clientId: code.clientId,
      userId: code.userId,
      redirectUri: code.redirectUri,
      codeChallenge: code.codeChallenge,
      scopes: code.scopes,
      resource: code.resource,
    };
  }

  async insertToken(
    tokenHash: string,
    kind: "access" | "refresh",
    record: TokenRecord,
    expiresAt: string,
  ): Promise<void> {
    this.tokens.set(tokenHash, {
      ...record,
      kind,
      expiresAt: new Date(expiresAt).getTime(),
      rotatedAt: null,
    });
  }

  async findAccessToken(tokenHash: string): Promise<(TokenRecord & { user: PublicUser }) | null> {
    const token = this.tokens.get(tokenHash);
    if (!token || token.kind !== "access" || token.expiresAt <= Date.now()) return null;
    const user = this.users.get(token.userId);
    if (!user || isBanned(user)) return null;
    return { ...token, user: publicUser(user) };
  }

  async rotateRefresh(
    oldHash: string,
    expectedClientId: string,
    expectedResource: string | null,
    accessHash: string,
    refreshHash: string,
    accessExpiresAt: string,
    refreshExpiresAt: string,
  ): Promise<TokenRecord | "reused" | null> {
    const current = this.tokens.get(oldHash);
    if (!current || current.kind !== "refresh" || current.clientId !== expectedClientId) return null;
    if (expectedResource && current.resource !== expectedResource) return null;
    if (current.rotatedAt !== null) {
      this.revokeFamily(current.familyId);
      return "reused";
    }
    if (current.expiresAt <= Date.now()) return null;
    current.rotatedAt = Date.now();
    const record: TokenRecord = {
      clientId: current.clientId,
      userId: current.userId,
      scopes: current.scopes,
      resource: current.resource,
      familyId: current.familyId,
    };
    await this.insertToken(accessHash, "access", record, accessExpiresAt);
    await this.insertToken(refreshHash, "refresh", record, refreshExpiresAt);
    return record;
  }

  async revokeToken(tokenHash: string): Promise<void> {
    const token = this.tokens.get(tokenHash);
    if (!token) return;
    if (token.kind === "refresh") this.revokeFamily(token.familyId);
    else this.tokens.delete(tokenHash);
  }

  async insertApiKey(record: ApiKeyRecord, keyHash: string): Promise<void> {
    this.apiKeys.set(record.id, { ...record, keyHash });
  }

  async listApiKeys(userId: string): Promise<ApiKeyRecord[]> {
    return [...this.apiKeys.values()]
      .filter((key) => key.userId === userId)
      .map(({ keyHash: _keyHash, ...record }) => record);
  }

  async revokeApiKey(id: string, userId: string): Promise<boolean> {
    const key = this.apiKeys.get(id);
    if (!key || key.userId !== userId || key.revokedAt) return false;
    key.revokedAt = new Date().toISOString();
    return true;
  }

  async findActiveApiKey(keyHash: string): Promise<{ key: ApiKeyRecord; user: PublicUser } | null> {
    for (const key of this.apiKeys.values()) {
      if (key.keyHash !== keyHash || key.revokedAt) continue;
      const user = this.users.get(key.userId);
      if (!user || isBanned(user)) return null;
      key.lastUsedAt = new Date().toISOString();
      const { keyHash: _keyHash, ...record } = key;
      return { key: record, user: publicUser(user) };
    }
    return null;
  }

  addSession(token: string, userId: string): void {
    this.sessions.set(token, userId);
  }

  private revokeUserAccess(userId: string): void {
    for (const [hash, token] of this.tokens) {
      if (token.userId === userId) this.tokens.delete(hash);
    }
    for (const key of this.apiKeys.values()) {
      if (key.userId === userId && !key.revokedAt) key.revokedAt = new Date().toISOString();
    }
  }

  private revokeFamily(familyId: string): void {
    for (const [hash, token] of this.tokens) {
      if (token.familyId === familyId) this.tokens.delete(hash);
    }
  }
}

function publicUser(user: MemoryUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    role: user.role,
    banned: user.banned,
    banReason: user.banReason,
    banExpires: user.banExpires,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    basicMode: user.basicMode ?? false,
  };
}

export function newId(): string {
  return randomUUID();
}

export function stamp(value: string | Date): string {
  return iso(value);
}
