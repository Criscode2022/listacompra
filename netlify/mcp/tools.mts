import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CATEGORIES, SERVER_NAME, SERVER_VERSION, TASK_VIEWS, UNITS, ServiceError, type Principal } from "./domain.mts";
import {
  banUser,
  createApiKey,
  createTask,
  createUser,
  currentPrincipal,
  deleteTask,
  deleteUser,
  getTask,
  getUser,
  listApiKeys,
  listTasks,
  listUsers,
  revokeApiKey,
  setUserPassword,
  unbanUser,
  updateTask,
  updateUser,
} from "./services.mts";
import type { Store } from "./store.mts";

const userId = z
  .string()
  .uuid()
  .optional()
  .describe("Neon user id. Required for the shared operator token. Admins may pass another user's id.");
const taskName = z
  .string()
  .describe("Product name. Names are unique per user and are the item identity used by the app.");

export function buildServer(store: Store, principal: Principal): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "Lista de la compra. A task is a shopping-list product in public.products (Despensa, Lista, Urgente). Users are Neon Auth accounts. A user token acts on that user's list. The shared operator token and local stdio must pass user_id. Confirm with the person before delete_user, delete_task, ban_user, or set_user_password for someone else.",
    },
  );

  const run = async (name: string, action: () => Promise<unknown>) => {
    try {
      const result = await action();
      console.error(JSON.stringify({ tool: name, method: principal.method, userId: principal.userId, ok: true }));
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tool failed.";
      console.error(
        JSON.stringify({
          tool: name,
          method: principal.method,
          userId: principal.userId,
          ok: false,
          code: error instanceof ServiceError ? error.code : "error",
        }),
      );
      return { isError: true as const, content: [{ type: "text" as const, text: message }] };
    }
  };

  server.registerTool(
    "get_current_user",
    {
      title: "Who am I",
      description: "Return the authenticated principal: method, user, admin flag, and scopes. Read-only.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => run("get_current_user", async () => currentPrincipal(principal)),
  );

  server.registerTool(
    "list_users",
    {
      title: "List users",
      description:
        "List Neon Auth users. Admins can search every account. Other callers receive only themselves. Read-only. Requires users:read.",
      inputSchema: {
        search: z.string().optional().describe("Case-insensitive match on name or email."),
        limit: z.number().int().min(1).max(100).optional().describe("Page size, default 50."),
        offset: z.number().int().min(0).optional().describe("Rows to skip, default 0."),
      },
      annotations: { readOnlyHint: true },
    },
    async (input) => run("list_users", () => listUsers(store, principal, input)),
  );

  server.registerTool(
    "get_user",
    {
      title: "Get user",
      description:
        "Get one user by id or email, including basic_mode. Callers can read themselves. Admins can read any account. Read-only. Requires users:read.",
      inputSchema: {
        user_id: userId,
        email: z.string().optional().describe("Email address. Use this or user_id."),
      },
      annotations: { readOnlyHint: true },
    },
    async (input) =>
      run("get_user", () => getUser(store, principal, { userId: input.user_id, email: input.email })),
  );

  server.registerTool(
    "create_user",
    {
      title: "Create user",
      description:
        "Create a Neon Auth email account and credential password. Admin only. The password is hashed with the same scrypt format the app uses and is not returned. email_verified defaults to true.",
      inputSchema: {
        name: z.string().describe("Display name."),
        email: z.string().describe("Email address."),
        password: z.string().describe("Password, 8 to 128 characters. Not stored in the tool result."),
        role: z.enum(["user", "admin"]).optional().describe("Defaults to user."),
        email_verified: z.boolean().optional().describe("Defaults to true so the person can sign in."),
      },
      annotations: { destructiveHint: false },
    },
    async (input) =>
      run("create_user", () =>
        createUser(store, principal, {
          name: input.name,
          email: input.email,
          password: input.password,
          role: input.role,
          emailVerified: input.email_verified,
        }),
      ),
  );

  server.registerTool(
    "update_user",
    {
      title: "Update user",
      description:
        "Update a user's name or basic_mode. Admins can also change email, role, and email_verified. Changing the email clears verification unless email_verified is set.",
      inputSchema: {
        user_id: userId,
        name: z.string().optional(),
        email: z.string().optional(),
        role: z.enum(["user", "admin"]).nullable().optional(),
        email_verified: z.boolean().optional(),
        basic_mode: z.boolean().optional().describe("App setting that hides categories."),
      },
    },
    async (input) =>
      run("update_user", () =>
        updateUser(store, principal, {
          userId: input.user_id,
          name: input.name,
          email: input.email,
          role: input.role,
          emailVerified: input.email_verified,
          basicMode: input.basic_mode,
        }),
      ),
  );

  server.registerTool(
    "set_user_password",
    {
      title: "Set password",
      description:
        "Change a password. The signed-in user must pass current_password. An admin can set another user's password without it: show the person the exact account and get confirmation first. Revokes that user's sessions and OAuth tokens. API keys stay valid.",
      inputSchema: {
        user_id: userId,
        new_password: z.string().describe("New password, 8 to 128 characters."),
        current_password: z.string().optional().describe("Required when changing your own password."),
      },
    },
    async (input) =>
      run("set_user_password", () =>
        setUserPassword(store, principal, {
          userId: input.user_id,
          newPassword: input.new_password,
          currentPassword: input.current_password,
        }),
      ),
  );

  server.registerTool(
    "ban_user",
    {
      title: "Ban user",
      description:
        "Ban a user, revoke their sessions, OAuth tokens, and API keys. Confirm with the person before calling. Admin only. Omit expires_in_seconds for a ban that does not expire.",
      inputSchema: {
        user_id: z.string().uuid().describe("User to ban."),
        reason: z.string().optional(),
        expires_in_seconds: z.number().int().optional().describe("Ban length in seconds, from 60 to 31536000."),
      },
      annotations: { destructiveHint: true },
    },
    async (input) =>
      run("ban_user", () =>
        banUser(store, principal, {
          userId: input.user_id,
          reason: input.reason,
          expiresInSeconds: input.expires_in_seconds,
        }),
      ),
  );

  server.registerTool(
    "unban_user",
    {
      title: "Unban user",
      description: "Remove a ban. Does not restore revoked API keys or sessions. Admin only.",
      inputSchema: { user_id: z.string().uuid() },
    },
    async (input) => run("unban_user", () => unbanUser(store, principal, input.user_id)),
  );

  server.registerTool(
    "delete_user",
    {
      title: "Delete user",
      description:
        "Permanently delete a Neon Auth user, their credential, sessions, shopping list, settings, API keys, and OAuth tokens. Confirm with the person before calling. Admin only. Cannot delete the signed-in account.",
      inputSchema: { user_id: z.string().uuid() },
      annotations: { destructiveHint: true },
    },
    async (input) => run("delete_user", () => deleteUser(store, principal, input.user_id)),
  );

  server.registerTool(
    "list_tasks",
    {
      title: "List tasks",
      description:
        "List shopping-list products. view=lista is unchecked and not urgent (Lista tab). view=despensa is everything that is not urgent. view=urgente is urgent items. view=all is the whole pantry. Read-only. Requires tasks:read.",
      inputSchema: {
        user_id: userId,
        view: z.enum(TASK_VIEWS).optional().describe("all, lista, despensa, or urgente. Default all."),
        category: z.enum(CATEGORIES).optional(),
        query: z.string().optional().describe("Case-insensitive name search."),
        checked: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (input) =>
      run("list_tasks", () =>
        listTasks(store, principal, {
          userId: input.user_id,
          view: input.view,
          category: input.category,
          query: input.query,
          checked: input.checked,
          limit: input.limit,
          offset: input.offset,
        }),
      ),
  );

  server.registerTool(
    "get_task",
    {
      title: "Get task",
      description: "Get one shopping item by its name. Read-only. Requires tasks:read.",
      inputSchema: { user_id: userId, name: taskName },
      annotations: { readOnlyHint: true },
    },
    async (input) =>
      run("get_task", () => getTask(store, principal, { name: input.name, userId: input.user_id })),
  );

  server.registerTool(
    "create_task",
    {
      title: "Create task",
      description:
        "Add a shopping item. Defaults: quantity 1, unit ud, category otros, urgent false, checked false. The name must be new for that user. Requires tasks:write.",
      inputSchema: {
        user_id: userId,
        name: taskName,
        quantity: z.number().int().min(1).max(999).optional(),
        unit: z.enum(UNITS).optional(),
        category: z.enum(CATEGORIES).optional(),
        urgent: z.boolean().optional().describe("True puts the item on the Urgente tab."),
        checked: z.boolean().optional().describe("True marks it as already bought."),
      },
    },
    async (input) =>
      run("create_task", () =>
        createTask(store, principal, {
          userId: input.user_id,
          name: input.name,
          quantity: input.quantity,
          unit: input.unit,
          category: input.category,
          urgent: input.urgent,
          checked: input.checked,
        }),
      ),
  );

  server.registerTool(
    "update_task",
    {
      title: "Update task",
      description:
        "Change quantity, unit, category, urgent, checked, or the name of a shopping item. new_name must not already exist for that user. Requires tasks:write.",
      inputSchema: {
        user_id: userId,
        name: taskName,
        new_name: z.string().optional(),
        quantity: z.number().int().min(1).max(999).optional(),
        unit: z.enum(UNITS).optional(),
        category: z.enum(CATEGORIES).optional(),
        urgent: z.boolean().optional(),
        checked: z.boolean().optional(),
      },
    },
    async (input) =>
      run("update_task", () =>
        updateTask(store, principal, {
          name: input.name,
          userId: input.user_id,
          newName: input.new_name,
          quantity: input.quantity,
          unit: input.unit,
          category: input.category,
          urgent: input.urgent,
          checked: input.checked,
        }),
      ),
  );

  server.registerTool(
    "set_task_checked",
    {
      title: "Check task",
      description:
        "Mark a shopping item bought or not bought. This is the checkbox in Despensa and Lista. Requires tasks:write.",
      inputSchema: {
        user_id: userId,
        name: taskName,
        checked: z.boolean().describe("True when the item has been bought."),
      },
      annotations: { idempotentHint: true },
    },
    async (input) =>
      run("set_task_checked", () =>
        updateTask(store, principal, {
          name: input.name,
          userId: input.user_id,
          checked: input.checked,
        }),
      ),
  );

  server.registerTool(
    "delete_task",
    {
      title: "Delete task",
      description:
        "Delete one shopping item by name. Confirm the exact name with the person before calling. Requires tasks:write.",
      inputSchema: { user_id: userId, name: taskName },
      annotations: { destructiveHint: true },
    },
    async (input) =>
      run("delete_task", () => deleteTask(store, principal, { name: input.name, userId: input.user_id })),
  );

  server.registerTool(
    "create_api_key",
    {
      title: "Create API key",
      description:
        "Mint a personal access token for a user. The plaintext key is returned once and only its hash is stored. Scopes cannot exceed the caller's scopes or the target user's role. Default scopes are the overlap of both.",
      inputSchema: {
        user_id: userId,
        label: z.string().describe("A name such as laptop or cursor."),
        scopes: z.array(z.enum(["tasks:read", "tasks:write", "users:read", "users:write"])).optional(),
      },
    },
    async (input) =>
      run("create_api_key", () =>
        createApiKey(store, principal, {
          userId: input.user_id,
          label: input.label,
          scopes: input.scopes,
        }),
      ),
  );

  server.registerTool(
    "list_api_keys",
    {
      title: "List API keys",
      description: "List API keys for the caller, or for another user when the caller is an admin. Never returns the key secret.",
      inputSchema: { user_id: userId },
      annotations: { readOnlyHint: true },
    },
    async (input) => run("list_api_keys", () => listApiKeys(store, principal, input.user_id)),
  );

  server.registerTool(
    "revoke_api_key",
    {
      title: "Revoke API key",
      description: "Revoke one API key by id. A revoked key stops working immediately.",
      inputSchema: {
        user_id: userId,
        id: z.string().uuid().describe("API key id from list_api_keys."),
      },
      annotations: { destructiveHint: true, idempotentHint: false },
    },
    async (input) =>
      run("revoke_api_key", () => revokeApiKey(store, principal, { id: input.id, userId: input.user_id })),
  );

  return server;
}
