import { Injectable } from '@angular/core';
import type { Database, SqlJsStatic, SqlValue } from 'sql.js';
import { MeasureUnit, Product, ProductCategory } from '../../types/product';

/**
 * Tiny SQLite wrapper for this app.
 *
 * How it works (3 steps):
 * 1. Load sql.js (SQLite compiled to WebAssembly) from /assets
 * 2. Open a database in memory (or restore the last saved file from IndexedDB)
 * 3. After each change, export the whole DB file and save it in IndexedDB
 *
 * See docs/SQLITE.md for a longer explanation.
 */

const DB_FILE_KEY = 'listacompra.sqlite';

@Injectable({ providedIn: 'root' })
export class SqliteService {
  private sql: SqlJsStatic | null = null;
  private db: Database | null = null;
  private opening: Promise<void> | null = null;

  /** Open the database (safe to call more than once). */
  open(): Promise<void> {
    if (!this.opening) {
      this.opening = this.openOnce();
    }
    return this.opening;
  }

  /** Read all products. */
  getProducts(): Product[] {
    const rows = this.select(
      'SELECT name, checked, quantity, urgent, unit, category FROM products ORDER BY name COLLATE NOCASE',
    );

    return rows.map((row) => ({
      name: String(row['name'] ?? ''),
      checked: Number(row['checked']) === 1,
      quantity: Number(row['quantity'] ?? 1) || 1,
      urgent: Number(row['urgent']) === 1,
      unit: (row['unit'] as MeasureUnit) || 'ud',
      category: (row['category'] as ProductCategory) || 'otros',
    }));
  }

  /** Replace the full product list and save. */
  async setProducts(products: Product[]): Promise<void> {
    const db = this.database();
    db.run('DELETE FROM products');

    for (const p of products) {
      db.run(
        'INSERT INTO products (name, checked, quantity, urgent, unit, category) VALUES (?, ?, ?, ?, ?, ?)',
        [
          p.name,
          p.checked ? 1 : 0,
          Number(p.quantity) || 1,
          p.urgent ? 1 : 0,
          p.unit || 'ud',
          p.category || 'otros',
        ],
      );
    }

    await this.save();
  }

  getBasicMode(): boolean {
    const rows = this.select(
      "SELECT value FROM app_settings WHERE key = 'basicMode'",
    );
    if (!rows.length) return false;
    return String(rows[0]['value']) === 'true';
  }

  async setBasicMode(enabled: boolean): Promise<void> {
    this.database().run(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('basicMode', ?)",
      [enabled ? 'true' : 'false'],
    );
    await this.save();
  }

  async clearAll(): Promise<void> {
    const db = this.database();
    db.run('DELETE FROM products');
    db.run('DELETE FROM app_settings');
    await this.save();
  }

  // ── private helpers ──────────────────────────────────────────────

  private database(): Database {
    if (!this.db) {
      throw new Error('Database not open. Call open() first.');
    }
    return this.db;
  }

  private select(sql: string, params: SqlValue[] = []): Record<string, unknown>[] {
    const stmt = this.database().prepare(sql);
    try {
      if (params.length) stmt.bind(params);
      const rows: Record<string, unknown>[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as Record<string, unknown>);
      }
      return rows;
    } finally {
      stmt.free();
    }
  }

  private async openOnce(): Promise<void> {
    this.sql = await this.loadSqlJs();

    // Restore previous DB file if we have one
    const saved = await this.readFile();
    this.db = saved
      ? new this.sql.Database(saved)
      : new this.sql.Database();

    // Create tables if they do not exist yet
    this.db.run(`
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
    `);

    await this.save();
  }

  /** Write the in-memory SQLite file into IndexedDB. */
  private async save(): Promise<void> {
    if (!this.db) return;
    await this.writeFile(this.db.export());
  }

  /** Load sql.js from /assets (not via webpack). */
  private loadSqlJs(): Promise<SqlJsStatic> {
    const wasmFolder = new URL('assets/', document.baseURI).href;

    type InitFn = (cfg: {
      locateFile: (f: string) => string;
    }) => Promise<SqlJsStatic>;

    const start = (initSqlJs: InitFn) =>
      initSqlJs({ locateFile: (file) => wasmFolder + file });

    const fromWindow = (window as unknown as { initSqlJs?: InitFn }).initSqlJs;
    if (typeof fromWindow === 'function') {
      return start(fromWindow);
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = wasmFolder + 'sql-wasm.js';
      script.onload = () => {
        const initSqlJs = (window as unknown as { initSqlJs?: InitFn })
          .initSqlJs;
        if (typeof initSqlJs !== 'function') {
          reject(new Error('sql.js failed to load'));
          return;
        }
        start(initSqlJs).then(resolve, reject);
      };
      script.onerror = () =>
        reject(new Error('Could not load assets/sql-wasm.js'));
      document.head.appendChild(script);
    });
  }

  private openIdb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('listacompra-db', 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('files')) {
          req.result.createObjectStore('files');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async readFile(): Promise<Uint8Array | null> {
    try {
      const idb = await this.openIdb();
      return await new Promise((resolve, reject) => {
        const req = idb.transaction('files', 'readonly').objectStore('files').get(DB_FILE_KEY);
        req.onsuccess = () => {
          idb.close();
          const value = req.result;
          if (value instanceof Uint8Array) resolve(value);
          else if (value instanceof ArrayBuffer) resolve(new Uint8Array(value));
          else resolve(null);
        };
        req.onerror = () => {
          idb.close();
          reject(req.error);
        };
      });
    } catch {
      return null;
    }
  }

  private async writeFile(bytes: Uint8Array): Promise<void> {
    const idb = await this.openIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction('files', 'readwrite');
      // Copy so IndexedDB can clone the data safely
      const copy = new Uint8Array(bytes);
      tx.objectStore('files').put(copy, DB_FILE_KEY);
      tx.oncomplete = () => {
        idb.close();
        resolve();
      };
      tx.onerror = () => {
        idb.close();
        reject(tx.error);
      };
    });
  }
}
