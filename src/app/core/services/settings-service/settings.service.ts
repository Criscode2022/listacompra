import { effect, Injectable, signal } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

export type AppMode = 'basic' | 'advanced';

export const CATEGORIES = [
  'Sin categoría',
  'Frutas y verduras',
  'Carnes y pescados',
  'Lácteos',
  'Panadería',
  'Bebidas',
  'Limpieza',
  'Higiene',
  'Congelados',
  'Otros',
] as const;

export type Category = (typeof CATEGORIES)[number];

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private _storage: Storage | null = null;
  public mode = signal<AppMode>('basic');

  constructor(private storage: Storage) {
    this.initSettings();
    effect(() => {
      this.storeMode(this.mode());
    });
  }

  private async initSettings() {
    const storage = await this.storage.create();
    this._storage = storage;

    const mode = await this._storage.get('appMode');
    if (mode) {
      this.mode.set(mode);
    }
  }

  private storeMode(mode: AppMode) {
    this._storage?.set('appMode', mode);
  }

  public toggleMode() {
    this.mode.update((current) => (current === 'basic' ? 'advanced' : 'basic'));
  }

  public isAdvanced() {
    return this.mode() === 'advanced';
  }
}
