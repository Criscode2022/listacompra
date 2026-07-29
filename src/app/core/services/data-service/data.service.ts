import { effect, Injectable, signal } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { BehaviorSubject } from 'rxjs';
import { Product } from '../../types/product';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private _storage: Storage | null = null;
  private syncCallback: (() => void) | null = null;
  private suppressSync = false;

  public storageInitialized = new BehaviorSubject<void>(undefined);
  public products = signal<Product[]>([]);
  public basicMode = signal<boolean>(false);

  constructor(private storage: Storage) {
    this.initStorage();
    effect(() => {
      this.storeData(this.products());
      if (!this.suppressSync) this.syncCallback?.();
    });
    effect(() => {
      this._storage?.set('settings', { basicMode: this.basicMode() });
      if (!this.suppressSync) this.syncCallback?.();
    });
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
    if (!skipSync) this.syncCallback?.();
  }

  async initStorage() {
    const storage = await this.storage.create();
    this._storage = storage;

    this.suppressSync = true;

    const products = await this._storage.get('products');

    if (products) {
      const migrated = products.map((p: Product) => ({
        ...p,
        unit: p.unit || 'ud',
        category: p.category || 'otros',
      }));
      this.products.set(migrated);
    }

    const settings = await this._storage.get('settings');
    if (settings?.basicMode !== undefined) {
      this.basicMode.set(Boolean(settings.basicMode));
    }

    this.suppressSync = false;
  }

  public storeData(products: Product[]) {
    this._storage?.set('products', products);
  }

  public async toggleStatus(productName: string) {
    this.products.update((products) => {
      return products.map((product) => {
        if (product.name === productName) {
          product.checked = !product.checked;

          if (product.checked) {
            product.quantity = 1;
          }
        }
        return product;
      });
    });
  }

  public async delete(productName: string) {
    this.products.update((products) => {
      return products.filter((product) => product.name !== productName);
    });
  }

  public async clearStorage() {
    await this._storage?.clear();
    this.products.set([]);
  }
}
