import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CATEGORIES, SERVER_NAME, SERVER_VERSION, TASK_VIEWS, UNITS, ServiceError, type Principal } from "./domain.mts";
import {
  createTask,
  currentPrincipal,
  deleteTask,
  getTask,
  listTasks,
  updateTask,
} from "./services.mts";
import type { Store } from "./store.mts";

const userId = z
  .string()
  .uuid()
  .optional()
  .describe("Neon user id. Required for the shared operator token. Admins may pass another user's id.");
const itemName = z
  .string()
  .describe("Product name. Names are unique per user and are the item identity used by the app.");

export function buildServer(store: Store, principal: Principal): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "Lista de la compra. An item is a shopping-list product in public.products. Despensa is everything that is not urgent, Lista is unchecked and not urgent, and Urgente is urgent items. A signed-in token acts on that user's list. The shared operator token and local stdio must pass user_id. Confirm the exact name with the person before delete_item.",
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
    "list_items",
    {
      title: "List items",
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
      run("list_items", async () => {
        const listed = await listTasks(store, principal, {
          userId: input.user_id,
          view: input.view,
          category: input.category,
          query: input.query,
          checked: input.checked,
          limit: input.limit,
          offset: input.offset,
        });
        return { items: listed.tasks, total: listed.total };
      }),
  );

  server.registerTool(
    "get_item",
    {
      title: "Get item",
      description: "Get one shopping item by its name. Read-only. Requires tasks:read.",
      inputSchema: { user_id: userId, name: itemName },
      annotations: { readOnlyHint: true },
    },
    async (input) =>
      run("get_item", () => getTask(store, principal, { name: input.name, userId: input.user_id })),
  );

  server.registerTool(
    "create_item",
    {
      title: "Create item",
      description:
        "Add a shopping item. Defaults: quantity 1, unit ud, category otros, urgent false, checked false. The name must be new for that user. Requires tasks:write.",
      inputSchema: {
        user_id: userId,
        name: itemName,
        quantity: z.number().int().min(1).max(999).optional(),
        unit: z.enum(UNITS).optional(),
        category: z.enum(CATEGORIES).optional(),
        urgent: z.boolean().optional().describe("True puts the item on the Urgente tab."),
        checked: z.boolean().optional().describe("True marks it as already bought."),
      },
    },
    async (input) =>
      run("create_item", () =>
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
    "update_item",
    {
      title: "Update item",
      description:
        "Change quantity, unit, category, urgent, checked, or the name of a shopping item. new_name must not already exist for that user. Requires tasks:write.",
      inputSchema: {
        user_id: userId,
        name: itemName,
        new_name: z.string().optional(),
        quantity: z.number().int().min(1).max(999).optional(),
        unit: z.enum(UNITS).optional(),
        category: z.enum(CATEGORIES).optional(),
        urgent: z.boolean().optional(),
        checked: z.boolean().optional(),
      },
    },
    async (input) =>
      run("update_item", () =>
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
    "set_item_checked",
    {
      title: "Check item",
      description:
        "Mark a shopping item bought or not bought. This is the checkbox in Despensa and Lista. Requires tasks:write.",
      inputSchema: {
        user_id: userId,
        name: itemName,
        checked: z.boolean().describe("True when the item has been bought."),
      },
      annotations: { idempotentHint: true },
    },
    async (input) =>
      run("set_item_checked", () =>
        updateTask(store, principal, {
          name: input.name,
          userId: input.user_id,
          checked: input.checked,
        }),
      ),
  );

  server.registerTool(
    "delete_item",
    {
      title: "Delete item",
      description:
        "Delete one shopping item by name. Confirm the exact name with the person before calling. Requires tasks:write.",
      inputSchema: { user_id: userId, name: itemName },
      annotations: { destructiveHint: true },
    },
    async (input) =>
      run("delete_item", () => deleteTask(store, principal, { name: input.name, userId: input.user_id })),
  );

  return server;
}
