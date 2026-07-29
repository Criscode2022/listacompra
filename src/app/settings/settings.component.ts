import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  IonicModule,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { AppModeService } from '../core/services/app-mode/app-mode.service';
import { DataService } from '../core/services/data-service/data.service';
import { AuthUser, NeonService } from '../core/services/neon/neon.service';
import { Product } from '../core/types/product';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
})
export class SettingsComponent implements OnInit {
  private modalCtrl = inject(ModalController);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private appMode = inject(AppModeService);
  private neon = inject(NeonService);
  private cdr = inject(ChangeDetectorRef);
  protected dataService = inject(DataService);

  protected onlineMode = false;
  protected onlineUser: AuthUser | null = null;
  protected switchingMode = false;

  private get isDesktop(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 768px)').matches
    );
  }

  ngOnInit(): void {
    this.onlineMode = this.appMode.isOnline() || this.appMode.hasOnlineIntent();
    void this.loadOnlineUser();
  }

  protected get onlineActive(): boolean {
    return this.appMode.isOnline();
  }

  protected get onlinePending(): boolean {
    return this.appMode.hasOnlineIntent();
  }

  private async loadOnlineUser(): Promise<void> {
    this.onlineUser = this.appMode.isOnline()
      ? await this.neon.getUser()
      : null;
    this.cdr.detectChanges();
  }

  protected close() {
    this.modalCtrl.dismiss();
  }

  protected async goToAuth(): Promise<void> {
    this.appMode.setOnlineIntent();
    this.onlineMode = true;
    await this.modalCtrl.dismiss(undefined, 'auth');
  }

  protected async onOnlineModeChange(event: CustomEvent): Promise<void> {
    const enabled = event.detail.checked;

    if (enabled) {
      this.appMode.setOnlineIntent();
      const session = await this.neon.getSession();
      if (session) {
        this.appMode.enableOnlineMode();
        this.onlineMode = true;
        this.onlineUser = await this.neon.getUser();
        this.cdr.detectChanges();
        await this.showStatusToast('Modo nube activado', false);
      } else {
        await this.goToAuth();
      }
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Desactivar modo nube',
      message:
        'Se cerrará tu sesión en la nube. Tus productos seguirán guardados en este dispositivo.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          handler: () => {
            this.onlineMode = true;
          },
        },
        {
          text: 'Desactivar',
          handler: () => void this.disableOnlineMode(),
        },
      ],
    });
    await alert.present();
  }

  protected async signOutOnline(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Cerrar sesión',
      message:
        'Se desactivará la sincronización en la nube. Tus productos locales no se borrarán.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Cerrar sesión',
          handler: () => void this.disableOnlineMode(),
        },
      ],
    });
    await alert.present();
  }

  private async disableOnlineMode(): Promise<void> {
    this.switchingMode = true;
    try {
      await this.neon.signOut();
      this.appMode.disableOnlineMode();
      this.onlineMode = false;
      this.onlineUser = null;
      this.cdr.detectChanges();
      await this.showStatusToast('Modo nube desactivado', false, 'medium');
    } finally {
      this.switchingMode = false;
      this.cdr.detectChanges();
    }
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
          .map((p: Product) => ({
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

  private async showStatusToast(
    message: string,
    isError = false,
    color: 'success' | 'danger' | 'medium' = 'success',
  ) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      position: 'bottom',
      color: isError ? 'danger' : color,
    });
    await toast.present();
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
