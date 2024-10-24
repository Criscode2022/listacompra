import { effect, Injectable, signal } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { BehaviorSubject } from 'rxjs';
import { Product } from '../../types/product';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private _storage: Storage | null = null;
  public storageInitialized = new BehaviorSubject<void>(undefined);
  public products = signal<Product[]>([]);

  constructor(private storage: Storage) {
    this.initStorage();
    effect(() => {
      this.storeData(this.products());
    });
  }

  async initStorage() {
    const storage = await this.storage.create();
    this._storage = storage;
    console.log('Storage initialized');

    const products = await this._storage.get('products');

    if (!products) {
      return;
    }

    this.products.set(products);
  }

  public storeData(value: any) {
    this._storage?.set('products', value);
    console.log('Product saved:', value);
  }

  public async getProducts(urgent = false) {
    if (!this._storage) {
      console.log('Storage not initialized');
      return [];
    }

    const prefix = urgent ? 'urgent:' : 'product:';
    const keys = await this._storage.keys();
    const filteredKeys = keys.filter((k) => k.startsWith(prefix));

    console.log('Storage keys:', filteredKeys);

    const products = [];

    for (let key of filteredKeys) {
      let productChecked = await this._storage.get(key);
      let product = { name: key.replace(prefix, ''), checked: productChecked };
      products.push(product);
    }

    return products;
  }

  public async delete(productName: string) {
    this.products.update((products) => {
      return products.filter((p) => p.name !== productName);
    });
  }

  public async clearStorage() {
    await this._storage?.clear();
    this.products.set([]);
  }
}
