import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { IonicModule, ModalController } from '@ionic/angular';
import { DataService } from 'src/app/core/services/data-service/data.service';
import {
  MEASURE_UNITS,
  PRODUCT_CATEGORIES,
  ProductCategory,
} from 'src/app/core/types/product';
import { AddProductModalComponent } from 'src/app/layout/add-product-modal/add-product-modal.component';
import { HeaderComponent } from 'src/app/layout/header/header.component';

@Component({
  selector: 'app-tab-urgent',
  templateUrl: 'tab-urgent.page.html',
  styleUrls: ['tab-urgent.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, HeaderComponent],
})
export class TabUrgent {
  private modalController = inject(ModalController);
  private dataService = inject(DataService);
  private snackbar = inject(MatSnackBar);

  protected products = this.dataService.products;
  protected categories = PRODUCT_CATEGORIES;
  protected measureUnits = MEASURE_UNITS;
  protected selectedFilter = signal<ProductCategory | 'all'>('all');

  protected urgentProducts = computed(() => {
    const filter = this.selectedFilter();
    return this.products().filter((product) => {
      if (!product.urgent) return false;
      if (filter !== 'all' && product.category !== filter) return false;
      return true;
    });
  });

  protected categoryCounts = computed(() => {
    const urgent = this.products().filter((product) => product.urgent);
    const counts: Record<string, number> = { all: urgent.length };
    for (const cat of this.categories) {
      counts[cat.value] = urgent.filter((p) => p.category === cat.value).length;
    }
    return counts;
  });

  protected setFilter(category: ProductCategory | 'all') {
    this.selectedFilter.set(category);
  }

  protected getCategoryColor(category: string): string {
    return (
      this.categories.find((c) => c.value === category)?.color ?? '#868e96'
    );
  }

  protected isAssetIcon(icon: string): boolean {
    return icon.startsWith('assets/');
  }

  protected getCategoryIconName(category: string): string | undefined {
    const icon =
      this.categories.find((c) => c.value === category)?.icon ??
      'ellipsis-horizontal-outline';
    return this.isAssetIcon(icon) ? undefined : icon;
  }

  protected getCategoryIconSrc(category: string): string | undefined {
    const icon =
      this.categories.find((c) => c.value === category)?.icon ??
      'ellipsis-horizontal-outline';
    return this.isAssetIcon(icon) ? icon : undefined;
  }

  protected async handleToggleChange(productName: string) {
    this.products.update((products) => {
      return products.filter((product) => {
        return product.name !== productName;
      });
    });
  }

  protected async addProduct() {
    const modal = await this.modalController.create({
      component: AddProductModalComponent,
      componentProps: { isUrgent: true },
      cssClass: 'add-product-modal',
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      handle: false,
    });

    await modal.present();
    const { data, role } = await modal.onWillDismiss();

    if (role !== 'confirm' || !data) return;

    const existingUrgent = this.urgentProducts();
    if (
      existingUrgent.some(
        (product) => product.name.toLowerCase() === data.name.toLowerCase(),
      )
    ) {
      this.snackbar.open(`Producto urgente ya existente`, 'Cerrar', {
        duration: 3000,
      });
      return;
    }

    this.products.update((products) => [
      ...products,
      {
        name: data.name,
        checked: false,
        quantity: data.quantity,
        urgent: true,
        unit: data.unit,
        category: data.category,
      },
    ]);

    this.snackbar.open(`Producto añadido correctamente`, 'Cerrar', {
      duration: 1500,
    });
  }
}
