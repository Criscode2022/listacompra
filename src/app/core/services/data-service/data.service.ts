import { effect, Injectable, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { MeasureUnit, Product, ProductCategory } from '../../types/product';
import { SqliteService } from '../sqlite/sqlite.service';

const SETTINGS_BASIC_MODE = 'basicMode';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private syncCallback: (() => void) | null = null;
  private suppressSync = true;
  private ready = false;
  private persistQueue: Promise<void> = Promise.resolve();

  public storageInitialized = new BehaviorSubject<void>(undefined);
  public products = signal<Product[]>([]);
  public basicMode = signal<boolean>(false);

  private readyResolve!: () => void;
  private readonly readyPromise = new Promise<void>((resolve) => {
    this.readyResolve = resolve;
  });

  constructor(private sqlite: SqliteService) {
    void this.initStorage();

    effect(() => {
      const products = this.products();
      if (!this.ready || this.suppressSync) return;
      this.enqueuePersist(() => this.storeData(products));
      this.syncCallback?.();
    });

    effect(() => {
      const basicMode = this.basicMode();
      if (!this.ready || this.suppressSync) return;
      this.enqueuePersist(() => this.storeSettings(basicMode));
      this.syncCallback?.();
    });
  }

  whenReady(): Promise<void> {
    return this.readyPromise;
  }

  setSyncCallback(cb: () => void): void {
    this.syncCallback = cb;
  }

  hasLocalData(): boolean {
    return this.products().length > 0;
  }

  replaceAllData(
    products: Product[],
    basicMode: boolean,
    skipSync = false,
  ): void {
    this.suppressSync = true;
    this.products.set(products);
    this.basicMode.set(basicMode);
    this.suppressSync = false;
    this.enqueuePersist(async () => {
      await this.storeData(products);
      await this.storeSettings(basicMode);
    });
    if (!skipSync) this.syncCallback?.();
  }

  async initStorage(): Promise<void> {
    try {
      await this.sqlite.initialize();
      this.suppressSync = true;

      const productRows = await this.sqlite.query(
        'SELECT name, checked, quantity, urgent, unit, category FROM products ORDER BY name COLLATE NOCASE ASC',
      );
      this.products.set(
        productRows.map((row) => ({
          name: String(row['name'] ?? ''),
          checked: Boolean(Number(row['checked'])),
          quantity: Number(row['quantity'] ?? 1) || 1,
          urgent: Boolean(Number(row['urgent'])),
          unit: (row['unit'] as MeasureUnit) || 'ud',
          category: (row['category'] as ProductCategory) || 'otros',
        })),
      );

      const settingsRows = await this.sqlite.query(
        'SELECT value FROM app_settings WHERE key = ?',
        [SETTINGS_BASIC_MODE],
      );
      if (settingsRows.length > 0) {
        const raw = String(settingsRows[0]['value'] ?? 'false');
        this.basicMode.set(raw === 'true' || raw === '1');
      }
    } catch (err) {
      console.error('SQLite initStorage failed', err);
    } finally {
      this.suppressSync = false;
      this.ready = true;
      this.storageInitialized.next();
      this.readyResolve();
    }
  }

  public async storeData(products: Product[]): Promise<void> {
    await this.sqlite.executeSet([
      { statement: 'DELETE FROM products', values: [] },
      ...products.map((product) => ({
        statement:
          'INSERT INTO products (name, checked, quantity, urgent, unit, category) VALUES (?,?,?,?,?,?)',
        values: [
          product.name,
          product.checked ? 1 : 0,
          Number(product.quantity) || 1,
          product.urgent ? 1 : 0,
          product.unit || 'ud',
          product.category || 'otros',
        ],
      })),
    ]);
    await this.sqlite.save();
  }

  public async storeSettings(basicMode: boolean): Promise<void> {
    await this.sqlite.run(
      'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
      [SETTINGS_BASIC_MODE, basicMode ? 'true' : 'false'],
    );
    await this.sqlite.save();
  }

  public async toggleStatus(productName: string): Promise<void> {
    this.products.update((products) =>
      products.map((product) => {
        if (product.name !== productName) return product;
        const checked = !product.checked;
        return {
          ...product,
          checked,
          quantity: checked ? 1 : product.quantity,
        };
      }),
    );
  }

  public async delete(productName: string): Promise<void> {
    this.products.update((products) =>
      products.filter((product) => product.name !== productName),
    );
  }

  public async clearStorage(): Promise<void> {
    this.suppressSync = true;
    try {
      await this.sqlite.execute('DELETE FROM products');
      await this.sqlite.execute('DELETE FROM app_settings');
      await this.sqlite.save();
      this.products.set([]);
      this.basicMode.set(false);
    } finally {
      this.suppressSync = false;
    }
  }

  private enqueuePersist(task: () => Promise<void>): void {
    this.persistQueue = this.persistQueue
      .then(() => task())
      .catch((err) => console.error('SQLite persist failed', err));
  }
}
