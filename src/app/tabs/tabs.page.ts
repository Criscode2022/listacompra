import {
  Component,
  HostBinding,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import {
  AlertController,
  ModalController,
  NavController,
  ToastController,
} from '@ionic/angular';
import { filter } from 'rxjs/operators';
import { AppModeService } from '../core/services/app-mode/app-mode.service';
import { DataService } from '../core/services/data-service/data.service';
import { NeonService } from '../core/services/neon/neon.service';
import { PRODUCT_CATEGORIES } from '../core/types/product';
import { matchesDesktopLayout } from '../core/utils/breakpoints';
import { SettingsComponent } from '../settings/settings.component';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
})
export class TabsPage {
  private modalCtrl = inject(ModalController);
  private navCtrl = inject(NavController);
  private router = inject(Router);
  private appMode = inject(AppModeService);
  private neon = inject(NeonService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  protected dataService = inject(DataService);

  isDesktopLayout = signal(matchesDesktopLayout());
  protected currentUrl = signal(this.router.url);
  protected cloudOn = signal(this.appMode.isOnline());
  protected cloudBusy = signal(false);

  pantryCount = computed(
    () => this.dataService.products().filter((product) => !product.urgent).length,
  );

  listCount = computed(
    () =>
      this.dataService
        .products()
        .filter((product) => !product.checked && !product.urgent).length,
  );

  urgentCount = computed(
    () => this.dataService.products().filter((product) => product.urgent).length,
  );

  protected railProducts = computed(() =>
    this.dataService
      .products()
      .filter((product) => !product.checked && !product.urgent),
  );

  protected showListRail = computed(() => {
    if (!this.isDesktopLayout()) return false;
    const url = this.currentUrl();
    // The list is the rail itself, and urgent is its own full-width board.
    return !url.includes('/lista') && !url.includes('/urgente');
  });

  @HostBinding('class.desktop-shell')
  get desktopShellClass(): boolean {
    return this.isDesktopLayout();
  }

  @HostBinding('class.has-rail')
  get hasRailClass(): boolean {
    return this.showListRail();
  }

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.currentUrl.set(event.urlAfterRedirects));

    this.appMode.watchMode().subscribe((mode) => {
      this.cloudOn.set(mode === 'online');
    });
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.isDesktopLayout.set(matchesDesktopLayout());
  }

  protected getCategoryColor(category: string): string {
    return (
      PRODUCT_CATEGORIES.find((item) => item.value === category)?.color ??
      '#868e96'
    );
  }

  protected async toggleCloud(): Promise<void> {
    if (this.cloudBusy()) return;
    if (this.cloudOn()) {
      await this.confirmDisableCloud();
      return;
    }
    await this.enableCloud();
  }

  private async enableCloud(): Promise<void> {
    this.cloudBusy.set(true);
    try {
      this.appMode.setOnlineIntent();
      const session = await this.neon.getSession();
      if (session) {
        this.appMode.enableOnlineMode();
        await this.showCloudToast('Modo nube activado');
        return;
      }
      await this.navCtrl.navigateRoot('/auth');
    } finally {
      this.cloudBusy.set(false);
    }
  }

  private async confirmDisableCloud(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Desactivar modo nube',
      message:
        'Se cerrará tu sesión en la nube. Tus productos seguirán guardados en este dispositivo.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Desactivar',
          handler: () => {
            void this.disableCloud();
          },
        },
      ],
    });
    await alert.present();
  }

  private async disableCloud(): Promise<void> {
    this.cloudBusy.set(true);
    try {
      await this.neon.signOut();
      this.appMode.disableOnlineMode();
      await this.showCloudToast('Modo nube desactivado', 'medium');
    } finally {
      this.cloudBusy.set(false);
    }
  }

  private async showCloudToast(
    message: string,
    color: 'success' | 'medium' = 'success',
  ): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2200,
      position: 'bottom',
      color,
    });
    await toast.present();
  }

  async openSettings() {
    const desktop = this.isDesktopLayout();
    const modal = await this.modalCtrl.create({
      component: SettingsComponent,
      cssClass: desktop
        ? 'settings-dialog glass-sheet'
        : 'settings-sheet glass-sheet',
      ...(desktop
        ? {}
        : {
            breakpoints: [0, 0.5, 0.85],
            initialBreakpoint: 0.5,
            handle: true,
            handleBehavior: 'cycle',
          }),
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'auth') {
      await this.navCtrl.navigateRoot('/auth');
    }
  }
}
