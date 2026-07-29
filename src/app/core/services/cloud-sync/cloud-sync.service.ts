import { Injectable } from '@angular/core';
import { Product } from '../../types/product';
import { AppModeService } from '../app-mode/app-mode.service';
import { DataService } from '../data-service/data.service';
import { NeonService } from '../neon/neon.service';

interface DbProduct {
  user_id: string;
  name: string;
  checked: boolean;
  quantity: number;
  urgent: boolean;
  unit: string;
  category: string;
}

interface DbSettings {
  basic_mode: boolean;
}

@Injectable({ providedIn: 'root' })
export class CloudSyncService {
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private syncing = false;

  constructor(
    private dataService: DataService,
    private appMode: AppModeService,
    private neon: NeonService,
  ) {
    this.dataService.setSyncCallback(() => this.schedulePush());
  }

  async uploadLocalData(userId?: string): Promise<{ products: number }> {
    const resolvedUserId = await this.requireUserId(userId);
    const products = this.dataService.products();

    if (products.length) {
      const rows = products.map((product) =>
        this.toDbProduct(product, resolvedUserId),
      );
      const { error } = await this.neon.client.from('products').insert(rows);
      if (error) throw new Error(error.message);
    }

    const { error: settingsErr } = await this.neon.client
      .from('user_settings')
      .insert({
        user_id: resolvedUserId,
        basic_mode: this.dataService.basicMode(),
      });
    if (settingsErr) throw new Error(settingsErr.message);

    return { products: products.length };
  }

  async downloadFromCloud(): Promise<void> {
    const session = await this.neon.getSession();
    if (!session) throw new Error('No hay sesión activa');

    const { data: products, error: productsErr } = await this.neon.client
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (productsErr) throw new Error(productsErr.message);

    const { data: settings, error: settingsErr } = await this.neon.client
      .from('user_settings')
      .select('basic_mode')
      .maybeSingle();

    if (settingsErr) throw new Error(settingsErr.message);

    this.dataService.replaceAllData(
      (products ?? []).map((row: DbProduct) => this.fromDbProduct(row)),
      Boolean((settings as DbSettings | null)?.basic_mode),
      true,
    );
  }

  private schedulePush(): void {
    if (!this.appMode.isOnline()) return;
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => void this.pushChanges(), 400);
  }

  private async pushChanges(): Promise<void> {
    if (!this.appMode.isOnline() || this.syncing) return;
    const user = await this.neon.getUser();
    if (!user) return;

    this.syncing = true;
    try {
      const products = this.dataService.products();
      const localNames = products.map((product) => product.name);
      const userId = user.id;

      const { data: cloudProducts } = await this.neon.client
        .from('products')
        .select('name');

      for (const row of cloudProducts ?? []) {
        const name = (row as { name: string }).name;
        if (!localNames.includes(name)) {
          await this.neon.client.from('products').delete().eq('name', name);
        }
      }

      if (products.length) {
        await this.neon.client
          .from('products')
          .upsert(products.map((product) => this.toDbProduct(product, userId)));
      }

      await this.neon.client.from('user_settings').upsert({
        user_id: userId,
        basic_mode: this.dataService.basicMode(),
      });
    } catch {
      // Silent fail — local data remains authoritative
    } finally {
      this.syncing = false;
    }
  }

  private async requireUserId(explicitUserId?: string): Promise<string> {
    if (explicitUserId) return explicitUserId;

    const user = await this.neon.getUser();
    if (!user?.id) throw new Error('No autenticado');
    return user.id;
  }

  private toDbProduct(product: Product, userId: string): DbProduct {
    return {
      user_id: userId,
      name: product.name,
      checked: product.checked,
      quantity: product.quantity,
      urgent: product.urgent,
      unit: product.unit,
      category: product.category,
    };
  }

  private fromDbProduct(row: DbProduct): Product {
    return {
      name: row.name,
      checked: row.checked,
      quantity: Number(row.quantity),
      urgent: row.urgent,
      unit: row.unit as Product['unit'],
      category: row.category as Product['category'],
    };
  }
}
