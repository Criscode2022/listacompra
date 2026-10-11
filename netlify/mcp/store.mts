import type {
  Category,
  PublicUser,
  Scope,
  ShoppingTask,
  TaskView,
  Unit,
} from "./domain.mts";

export interface ListUsersQuery {
  search?: string;
  limit: number;
  offset: number;
}

export interface ListTasksQuery {
  userId: string;
  view: TaskView;
  category?: Category;
  query?: string;
  checked?: boolean;
  limit: number;
  offset: number;
}

export interface NewTask {
  userId: string;
  name: string;
  quantity: number;
  unit: Unit;
  category: Category;
  urgent: boolean;
  checked: boolean;
}

export interface TaskPatch {
  name?: string;
  quantity?: number;
  unit?: Unit;
  category?: Category;
  urgent?: boolean;
  checked?: boolean;
}

export interface NewUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string | null;
  emailVerified: boolean;
}

export interface UserPatch {
  name?: string;
  email?: string;
  role?: string | null;
  emailVerified?: boolean;
  basicMode?: boolean;
}

export type ClientAuthMethod = "none" | "client_secret_basic" | "client_secret_post";

export interface StoredClient {
  id: string;
  name: string;
  redirectUris: string[];
  secretHash: string | null;
  authMethod: ClientAuthMethod;
}

export interface AuthRequestRecord {
  id: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scopes: Scope[];
  resource: string;
  expiresAt: string;
  consumed: boolean;
}

export interface AuthCodeRecord {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: Scope[];
  resource: string;
}

export interface TokenRecord {
  clientId: string;
  userId: string;
  scopes: Scope[];
  resource: string;
  familyId: string;
}

export interface ApiKeyRecord {
  id: string;
  userId: string;
  label: string;
  prefix: string;
  scopes: Scope[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface Store {
  ensureSchema(): Promise<void>;
  listUsers(query: ListUsersQuery): Promise<{ users: PublicUser[]; total: number }>;
  getUserById(id: string): Promise<PublicUser | null>;
  getUserByEmail(email: string): Promise<PublicUser | null>;
  getPasswordHash(userId: string): Promise<string | null>;
  insertUser(user: NewUser): Promise<PublicUser>;
  updateUser(id: string, patch: UserPatch): Promise<PublicUser | null>;
  setPasswordHash(userId: string, passwordHash: string): Promise<boolean>;
  banUser(
    id: string,
    reason: string | null,
    banExpires: string | null,
  ): Promise<PublicUser | null>;
  unbanUser(id: string): Promise<PublicUser | null>;
  deleteUser(id: string): Promise<boolean>;
  findSessionUser(token: string, tokenHash: string): Promise<PublicUser | null>;
  listTasks(query: ListTasksQuery): Promise<{ tasks: ShoppingTask[]; total: number }>;
  getTask(userId: string, name: string): Promise<ShoppingTask | null>;
  insertTask(task: NewTask): Promise<ShoppingTask>;
  updateTask(userId: string, name: string, patch: TaskPatch): Promise<ShoppingTask | null>;
  deleteTask(userId: string, name: string): Promise<boolean>;
  getBasicMode(userId: string): Promise<boolean>;
  insertClient(client: StoredClient): Promise<void>;
  getClient(id: string): Promise<StoredClient | null>;
  insertAuthRequest(request: AuthRequestRecord): Promise<void>;
  getAuthRequest(id: string): Promise<AuthRequestRecord | null>;
  consumeAuthRequest(id: string): Promise<AuthRequestRecord | null>;
  insertAuthCode(codeHash: string, code: AuthCodeRecord, expiresAt: string): Promise<void>;
  consumeAuthCode(codeHash: string): Promise<AuthCodeRecord | null>;
  insertToken(
    tokenHash: string,
    kind: "access" | "refresh",
    record: TokenRecord,
    expiresAt: string,
  ): Promise<void>;
  findAccessToken(tokenHash: string): Promise<(TokenRecord & { user: PublicUser }) | null>;
  rotateRefresh(
    oldHash: string,
    expectedClientId: string,
    expectedResource: string | null,
    accessHash: string,
    refreshHash: string,
    accessExpiresAt: string,
    refreshExpiresAt: string,
  ): Promise<TokenRecord | "reused" | null>;
  revokeToken(tokenHash: string): Promise<void>;
  insertApiKey(record: ApiKeyRecord, keyHash: string): Promise<void>;
  listApiKeys(userId: string): Promise<ApiKeyRecord[]>;
  revokeApiKey(id: string, userId: string): Promise<boolean>;
  findActiveApiKey(
    keyHash: string,
  ): Promise<{ key: ApiKeyRecord; user: PublicUser } | null>;
}
