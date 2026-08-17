import {
  Component,
  HostBinding,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { ModalController, NavController } from '@ionic/angular';
import { filter } from 'rxjs/operators';
import { DataService } from '../core/services/data-service/data.service';
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
  protected dataService = inject(DataService);

  isDesktopLayout = signal(matchesDesktopLayout());
  protected currentUrl = signal(this.router.url);

  protected pantryCount = computed(
    () => this.dataService.products().filter((product) => !product.urgent).length,
  );

  protected listCount = computed(
    () =>
      this.dataService
        .products()
        .filter((product) => !product.checked && !product.urgent).length,
  );

  protected urgentCount = computed(
    () => this.dataService.products().filter((product) => product.urgent).length,
  );

  protected railProducts = computed(() =>
    this.dataService
      .products()
      .filter((product) => !product.checked && !product.urgent),
  );

  protected showListRail = computed(
    () => this.isDesktopLayout() && !this.currentUrl().includes('/lista'),
  );

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
