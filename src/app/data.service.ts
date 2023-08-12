import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Storage } from '@ionic/storage-angular';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private _storage: Storage | null = null;
  public storageInitialized = new BehaviorSubject<void>(undefined); // New event
  public productsUpdated = new BehaviorSubject<void>(undefined);

  constructor(private storage: Storage) {
    this.init();
  }

  public async remove(key: string, urgent: boolean = false) {
    const prefix = urgent ? 'urgent:' : 'product:';
    await this._storage?.remove(prefix + key);
    this.productsUpdated.next();
    console.log('Product removed:', prefix + key);
  }

  async init() {
    const storage = await this.storage.create();
    this._storage = storage;
    console.log('Storage initialized');
    this.storageInitialized.next(); // Emit the event after storage is initialized
  }

  public set(key: string, value: any, urgent: boolean = false) {
    const prefix = urgent ? 'urgent:' : 'product:';
    this._storage?.set(prefix + key, value);
    this.productsUpdated.next(value);
    console.log('Product saved:', prefix + key, value); // new logging line
  }

  public async get(key: string, urgent: boolean = false) {
    const prefix = urgent ? 'urgent:' : 'product:';
    return await this._storage?.get(prefix + key);
  }

  public async getProducts(urgent: boolean = false) {
    if (!this._storage) {
      console.log('Storage not initialized');
      return [];
    }

    const prefix = urgent ? 'urgent:' : 'product:';
    const keys = await this._storage.keys();
    const filteredKeys = keys.filter((k) => k.startsWith(prefix));

    console.log('Storage keys:', filteredKeys); // new logging line

    const products = [];

    for (let key of filteredKeys) {
      let productChecked = await this._storage.get(key);
      let product = { name: key.replace(prefix, ''), checked: productChecked };
      products.push(product);
    }

    return products;
  }

  public clear() {
    this._storage?.clear().then(() => {
      console.log('All keys cleared');
      this.productsUpdated.next(); // Trigger an update event
    });
  }
}
