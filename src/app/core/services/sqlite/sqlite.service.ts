import { Injectable } from '@angular/core';
import type { Database, SqlJsStatic, SqlValue } from 'sql.js';

/** SQLite (sql.js WASM) persisted as a binary blob in IndexedDB. */

const IDB_NAME = 'listacompra-sqlite-v1';
const IDB_STORE = 'databases';
const IDB_KEY = 'main';

export interface SqlStatement {
  statement: string;
  values?: unknown[];
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS products (
  name TEXT PRIMARY KEY NOT NULL,
  checked INTEGER NOT NULL DEFAULT 0,
  quantity REAL NOT NULL DEFAULT 1,
  urgent INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'ud',
  category TEXT NOT NULL DEFAULT 'otros'
);
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;

type InitSqlJsFn = (config?: {
  locateFile?: (file: string) => string;
}) => Promise<SqlJsStatic>;

function getInitSqlJs(): InitSqlJsFn | undefined {
  const fn = (window as unknown as { initSqlJs?: InitSqlJsFn }).initSqlJs;
  return typeof fn === 'function' ? fn : undefined;
}

function assetUrl(file: string): string {
  try {
    return new URL(`assets/${file}`, document.baseURI).href;
  } catch {
    return `assets/${file}`;
  }
}

@Injectable({ providedIn: 'root' })
export class SqliteService {
  private SQL: SqlJsStatic | null = null;
  private db: Database | null = null;
  private initPromise: Promise<void> | null = null;

  initialize(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.doInitialize().catch((err) => {
        this.initPromise = null;
        throw err;
      });
    }
    return this.initPromise;
  }

  async query(
    statement: string,
    values: unknown[] = [],
  ): Promise<Record<string, unknown>[]> {
    const db = this.requireDb();
    const stmt = db.prepare(statement);
    try {
      if (values.length) stmt.bind(values as SqlValue[]);
      const rows: Record<string, unknown>[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as Record<string, unknown>);
      }
      return rows;
    } finally {
      stmt.free();
    }
  }

  async run(statement: string, values: unknown[] = []): Promise<void> {
    const db = this.requireDb();
    if (values.length) db.run(statement, values as SqlValue[]);
    else db.run(statement);
  }

  async execute(statements: string): Promise<void> {
    this.requireDb().run(statements);
  }

  async executeSet(set: SqlStatement[]): Promise<void> {
    const db = this.requireDb();
    db.run('BEGIN');
    try {
      for (const item of set) {
        const values = item.values ?? [];
        if (values.length) db.run(item.statement, values as SqlValue[]);
        else db.run(item.statement);
      }
      db.run('COMMIT');
    } catch (err) {
      try {
        db.run('ROLLBACK');
      } catch {
        // ignore
      }
      throw err;
    }
  }

  /** Persist the in-memory SQLite DB to IndexedDB. */
  async save(): Promise<void> {
    if (!this.db) return;
    const data = this.db.export();
    await this.savePersistedDb(data);
  }

  private requireDb(): Database {
    if (!this.db) throw new Error('SQLite database is not initialized');
    return this.db;
  }

  private async doInitialize(): Promise<void> {
    this.SQL = await this.loadSqlJs();
    const existing = await this.loadPersistedDb();
    this.db = existing
      ? new this.SQL.Database(existing)
      : new this.SQL.Database();
    this.db.run(SCHEMA_SQL);
    await this.save();
  }

  private loadSqlJs(): Promise<SqlJsStatic> {
    const boot = (initSqlJs: InitSqlJsFn) =>
      initSqlJs({ locateFile: (file) => assetUrl(file) });

    const existing = getInitSqlJs();
    if (existing) return boot(existing);

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = assetUrl('sql-wasm.js');
      script.async = true;
      script.onload = () => {
        const initSqlJs = getInitSqlJs();
        if (!initSqlJs) {
          reject(new Error('initSqlJs not available after script load'));
          return;
        }
        boot(initSqlJs).then(resolve).catch(reject);
      };
      script.onerror = () =>
        reject(new Error('Failed to load assets/sql-wasm.js'));
      document.head.appendChild(script);
    });
  }

  private openIdb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(IDB_STORE)) {
          req.result.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () =>
        reject(req.error ?? new Error('IndexedDB open failed'));
    });
  }

  private async loadPersistedDb(): Promise<Uint8Array | null> {
    if (typeof indexedDB === 'undefined') return null;
    try {
      const idb = await this.openIdb();
      return await new Promise((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
        req.onsuccess = () => {
          const value = req.result;
          idb.close();
          if (value instanceof Uint8Array) resolve(value);
          else if (value instanceof ArrayBuffer)
            resolve(new Uint8Array(value));
          else resolve(null);
        };
        req.onerror = () => {
          idb.close();
          reject(req.error ?? new Error('IndexedDB read failed'));
        };
      });
    } catch {
      return null;
    }
  }

  private async savePersistedDb(data: Uint8Array): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    const idb = await this.openIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      const copy = new Uint8Array(data.byteLength);
      copy.set(data);
      tx.objectStore(IDB_STORE).put(copy, IDB_KEY);
      tx.oncomplete = () => {
        idb.close();
        resolve();
      };
      tx.onerror = () => {
        idb.close();
        reject(tx.error ?? new Error('IndexedDB write failed'));
      };
    });
  }
}
