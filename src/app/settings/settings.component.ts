import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  AlertController,
  IonicModule,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { DataService } from '../core/services/data-service/data.service';
import { Product } from '../core/types/product';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule],
})
export class SettingsComponent {
  private modalCtrl = inject(ModalController);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  protected dataService = inject(DataService);

  private get isDesktop(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 768px)').matches
    );
  }

  protected close() {
    this.modalCtrl.dismiss();
  }

  protected async clearAllData() {
    const alert = await this.alertCtrl.create({
      header: 'Confirmar borrado',
      message: this.isDesktop
        ? '¿Seguro que quieres borrar todos los productos? Esta acción no puede ser revertida'
        : '¿Seguro que quieres borrar todos los productos? Si solo quieres eliminar un producto puedes deslizarlo hacia la izquierda',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Borrar',
          role: 'destructive',
          handler: () => {
            this.dataService.clearStorage();
            this.close();
          },
        },
      ],
    });
    await alert.present();
  }

  protected exportProducts() {
    const products = this.dataService.products();
    const json = JSON.stringify(products, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'productos.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  protected importProducts() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!Array.isArray(data)) throw new Error('not-array');
        const migrated: Product[] = data
          .map((p: any) => ({
            name: String(p.name ?? '').trim(),
            checked: Boolean(p.checked ?? false),
            quantity: Number(p.quantity ?? 1),
            urgent: Boolean(p.urgent ?? false),
            unit: p.unit ?? 'ud',
            category: p.category ?? 'otros',
          }))
          .filter((p: Product) => p.name.length > 0);
        if (migrated.length === 0) throw new Error('empty');
        this.dataService.products.set(migrated);
        await this.showToast(
          `${migrated.length} producto${migrated.length !== 1 ? 's' : ''} importado${migrated.length !== 1 ? 's' : ''}`,
          'checkmark-circle-outline',
        );
        this.close();
      } catch {
        await this.showToast(
          'Error al importar: archivo no válido',
          'alert-circle-outline',
          true,
        );
      }
    };
    input.click();
  }

  private async showToast(
    message: string,
    icon: string,
    isError = false,
  ) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      position: 'bottom',
      icon,
      color: isError ? 'danger' : 'success',
    });
    await toast.present();
  }
}
