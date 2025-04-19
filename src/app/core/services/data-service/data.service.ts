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

    const products = await this._storage.get('products');

    if (!products) {
      return;
    }

    this.products.set(products);
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
