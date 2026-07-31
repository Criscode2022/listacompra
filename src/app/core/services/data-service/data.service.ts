import { effect, Injectable, signal } from '@angular/core';
import { Product } from '../../types/product';
import { SqliteService } from '../sqlite/sqlite.service';

/**
 * App state for products and settings.
 * Loads from SQLite on start; saves back whenever the signals change.
 */
@Injectable({
  providedIn: 'root',
})
export class DataService {
  private syncCallback: (() => void) | null = null;
  /** false until the first load finishes — avoids saving empty data at startup */
  private ready = false;

  public products = signal<Product[]>([]);
  public basicMode = signal<boolean>(false);

  private readyResolve!: () => void;
  private readonly readyPromise = new Promise<void>((resolve) => {
    this.readyResolve = resolve;
  });

  constructor(private sqlite: SqliteService) {
    void this.load();

    // Auto-save when products change (after load is done)
    effect(() => {
      const products = this.products();
      if (!this.ready) return;
      void this.sqlite.setProducts(products).catch(console.error);
      this.syncCallback?.();
    });

    // Auto-save when basicMode changes
    effect(() => {
      const basicMode = this.basicMode();
      if (!this.ready) return;
      void this.sqlite.setBasicMode(basicMode).catch(console.error);
      this.syncCallback?.();
    });
  }

  /** Wait until products have been loaded from SQLite. */
  whenReady(): Promise<void> {
    return this.readyPromise;
  }

  setSyncCallback(cb: () => void): void {
    this.syncCallback = cb;
  }

  hasLocalData(): boolean {
    return this.products().length > 0;
  }

  /** Replace everything (used by cloud sync / import). */
  replaceAllData(
    products: Product[],
    basicMode: boolean,
    skipSync = false,
  ): void {
    this.ready = false;
    this.products.set(products);
    this.basicMode.set(basicMode);
    this.ready = true;
    void this.sqlite.setProducts(products).catch(console.error);
    void this.sqlite.setBasicMode(basicMode).catch(console.error);
    if (!skipSync) this.syncCallback?.();
  }

  async toggleStatus(productName: string): Promise<void> {
    this.products.update((list) =>
      list.map((p) => {
        if (p.name !== productName) return p;
        const checked = !p.checked;
        return { ...p, checked, quantity: checked ? 1 : p.quantity };
      }),
    );
  }

  async delete(productName: string): Promise<void> {
    this.products.update((list) => list.filter((p) => p.name !== productName));
  }

  async clearStorage(): Promise<void> {
    this.ready = false;
    await this.sqlite.clearAll();
    this.products.set([]);
    this.basicMode.set(false);
    this.ready = true;
  }

  private async load(): Promise<void> {
    try {
      await this.sqlite.open();
      this.products.set(this.sqlite.getProducts());
      this.basicMode.set(this.sqlite.getBasicMode());
    } catch (err) {
      console.error('Failed to load SQLite data', err);
    } finally {
      this.ready = true;
      this.readyResolve();
    }
  }
}
