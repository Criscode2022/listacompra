# How SQLite works in Lista de la compra

This app stores products and settings in **SQLite**, running inside the browser with **sql.js**.

You do not need to know SQL to use the app. This document is for developers who want to understand (or change) storage.

---

## Big picture

```
┌─────────────┐     signals      ┌──────────────┐     SQL      ┌─────────────┐
│  UI (tabs)  │ ───────────────► │ DataService  │ ───────────► │ SqliteService│
└─────────────┘                  └──────────────┘              └──────┬──────┘
                                                                       │
                                                          in-memory SQLite DB
                                                                       │
                                                              save whole file
                                                                       ▼
                                                              IndexedDB (browser)
```

1. **UI** only talks to `DataService` (Angular signals: `products`, `basicMode`).
2. **DataService** loads data once at startup, then auto-saves when signals change.
3. **SqliteService** runs real SQL and keeps one SQLite database file in memory.
4. After every write, that file is **exported as bytes** and stored in **IndexedDB** so it survives refresh.

---

## Why SQLite in the browser?

- **Tables and queries** instead of a big JSON blob.
- Same idea as a “real” database (easy to understand and extend).
- **sql.js** = SQLite compiled to WebAssembly (WASM), so it runs without a server.

We do **not** use the old Ionic Storage / raw key-value IndexedDB API for products anymore.

---

## Files involved

| File | Role |
|------|------|
| `src/app/core/services/sqlite/sqlite.service.ts` | Open DB, run SQL, save/load the DB file |
| `src/app/core/services/data-service/data.service.ts` | App state + when to load/save |
| `src/assets/sql-wasm.js` | sql.js library (loaded as a script) |
| `src/assets/sql-wasm.wasm` | SQLite engine (must match the same sql.js version) |
| IndexedDB `listacompra-db` → store `files` → key `listacompra.sqlite` | Where the DB file is persisted |

---

## Database schema

Two tables:

### `products`

| Column | Type | Meaning |
|--------|------|---------|
| `name` | TEXT (primary key) | Product name |
| `checked` | INTEGER 0/1 | Bought? |
| `quantity` | REAL | Amount |
| `urgent` | INTEGER 0/1 | Urgent list? |
| `unit` | TEXT | e.g. `ud`, `kg`, `l` |
| `category` | TEXT | e.g. `frutas`, `otros` |

### `app_settings`

| Column | Type | Meaning |
|--------|------|---------|
| `key` | TEXT (primary key) | Setting name |
| `value` | TEXT | Setting value |

Currently only `basicMode` → `'true'` / `'false'`.

---

## Startup flow

```
App starts
   → DataService constructor runs load()
   → SqliteService.open()
        1. Load sql-wasm.js + sql-wasm.wasm from /assets
        2. Read previous DB bytes from IndexedDB (if any)
        3. Create SQLite database in memory
        4. CREATE TABLE IF NOT EXISTS ...
   → DataService reads getProducts() / getBasicMode()
   → fills signals
   → ready = true  (auto-save may run from now on)
```

Until `ready` is true, signal effects **do not save**, so an empty list at boot does not wipe the database.

---

## Save flow

When the user adds, edits, or deletes a product:

```
products signal changes
   → effect in DataService
   → sqlite.setProducts(list)
        DELETE FROM products
        INSERT each product
        export DB → write bytes to IndexedDB
```

Settings work the same way with `setBasicMode()`.

---

## Public API of `SqliteService` (simple)

| Method | What it does |
|--------|----------------|
| `open()` | Load engine + open/create DB |
| `getProducts()` | `SELECT` all products |
| `setProducts(list)` | Replace all products + save file |
| `getBasicMode()` | Read setting |
| `setBasicMode(bool)` | Write setting + save file |
| `clearAll()` | Empty tables + save file |

`DataService` should be the only place that calls these in normal app code.

---

## Important: matching WASM files

`sql-wasm.js` and `sql-wasm.wasm` in `src/assets/` **must** come from the **same** `sql.js` npm version.

If you upgrade `sql.js`:

```bash
npm install sql.js@<version>
copy node_modules\sql.js\dist\sql-wasm.js src\assets\
copy node_modules\sql.js\dist\sql-wasm.wasm src\assets\
```

A mismatch can break startup with WebAssembly link errors.

sql.js is loaded as a **script tag** (not imported by webpack) so Angular does not try to polyfill Node modules like `fs` / `path`.

---

## Debugging tips

1. **Application → IndexedDB → `listacompra-db`** in DevTools: you should see a binary entry for `listacompra.sqlite` after adding a product.
2. Console errors about `sql-wasm` usually mean missing assets or a version mismatch.
3. After code changes, do a hard refresh (Ctrl+Shift+R).

---

## What this is *not*

- **Not** a remote database (Neon cloud sync is separate).
- **Not** jeep-sqlite / Capacitor Community SQLite (removed because WASM setup was fragile on web).
- **Not** a full migration framework — schema is created with `CREATE TABLE IF NOT EXISTS` only.

---

## Mental model (one sentence)

> The app keeps a real SQLite database in memory, and after each change it saves a snapshot of that database file into IndexedDB so the next visit can restore it.
