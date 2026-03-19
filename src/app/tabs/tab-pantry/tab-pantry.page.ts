import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AlertController, IonicModule, ModalController } from '@ionic/angular';
import { DataService } from 'src/app/core/services/data-service/data.service';
import {
  MEASURE_UNITS,
  PRODUCT_CATEGORIES,
  ProductCategory,
} from 'src/app/core/types/product';
import { AddProductModalComponent } from 'src/app/layout/add-product-modal/add-product-modal.component';
import { HeaderComponent } from 'src/app/layout/header/header.component';
import { StopPropagationDirective } from '../../core/directives/stop-propagation/stop-propagation.directive';

@Component({
  selector: 'app-tab-pantry',
  templateUrl: 'tab-pantry.page.html',
  styleUrls: ['tab-pantry.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HeaderComponent,
    StopPropagationDirective,
  ],
})
export class TabPantry {
  private modalController = inject(ModalController);
  private alertController = inject(AlertController);
  protected dataService = inject(DataService);
  private snackbar = inject(MatSnackBar);

  protected products = this.dataService.products;
  protected categories = PRODUCT_CATEGORIES;
  protected measureUnits = MEASURE_UNITS;

  protected selectedFilter = signal<ProductCategory | 'all'>('all');

  protected pantryProducts = computed(() => {
    const filter = this.selectedFilter();
    return this.products().filter((product) => {
      if (product.urgent) return false;
      if (filter !== 'all' && product.category !== filter) return false;
      return true;
    });
  });

  protected categoryCounts = computed(() => {
    const pantry = this.products().filter((p) => !p.urgent);
    const counts: Record<string, number> = { all: pantry.length };
    for (const cat of this.categories) {
      counts[cat.value] = pantry.filter((p) => p.category === cat.value).length;
    }
    return counts;
  });

  protected setFilter(category: ProductCategory | 'all') {
    this.selectedFilter.set(category);
  }

  protected getCategoryColor(category: ProductCategory): string {
    return (
      this.categories.find((c) => c.value === category)?.color ?? '#868e96'
    );
  }

  protected isAssetIcon(icon: string): boolean {
    return icon.startsWith('assets/');
  }

  protected getCategoryIconName(category: ProductCategory): string | undefined {
    const icon =
      this.categories.find((c) => c.value === category)?.icon ??
      'ellipsis-horizontal-outline';
    return this.isAssetIcon(icon) ? undefined : icon;
  }

  protected getCategoryIconSrc(category: ProductCategory): string | undefined {
    const icon =
      this.categories.find((c) => c.value === category)?.icon ??
      'ellipsis-horizontal-outline';
    return this.isAssetIcon(icon) ? icon : undefined;
  }

  protected getUnitLabel(unit: string): string {
    return this.measureUnits.find((u) => u.value === unit)?.label ?? unit;
  }

  protected async addProduct() {
    const modal = await this.modalController.create({
      component: AddProductModalComponent,
      componentProps: { isUrgent: false },
      cssClass: 'add-product-modal',
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      handle: false,
    });

    await modal.present();
    const { data, role } = await modal.onWillDismiss();

    if (role !== 'confirm' || !data) return;

    const existingProducts = this.products();
    if (
      existingProducts.some(
        (product) => product.name.toLowerCase() === data.name.toLowerCase(),
      )
    ) {
      this.snackbar.open(`Producto ya existente`, 'Cerrar', {
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
        urgent: false,
        unit: data.unit,
        category: data.category,
      },
    ]);

    this.snackbar.open(`Producto añadido correctamente`, 'Cerrar', {
      duration: 1500,
    });
  }

  protected async editQuantity(productName: string, currentQuantity: number) {
    const alert = await this.alertController.create({
      header: 'Editar cantidad',
      inputs: [
        {
          name: 'quantity',
          type: 'number',
          value: String(currentQuantity),
          min: 1,
          attributes: {
            inputmode: 'numeric',
            pattern: '[0-9]*',
            min: 1,
          },
          placeholder: 'Cantidad',
        },
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Guardar',
          handler: (data) => {
            const raw = String(data?.quantity ?? '').trim();
            if (!/^\d+$/.test(raw)) {
              this.snackbar.open('Introduce solo numeros enteros', 'Cerrar', {
                duration: 2000,
              });
              return false;
            }

            const quantity = Number(raw);
            if (!Number.isInteger(quantity) || quantity < 1) {
              this.snackbar.open('La cantidad debe ser mayor que 0', 'Cerrar', {
                duration: 2000,
              });
              return false;
            }

            this.products.update((products) => {
              return products.map((product) => {
                if (product.name === productName) {
                  product.quantity = quantity;
                  product.checked = false;
                }
                return product;
              });
            });

            return true;
          },
        },
      ],
    });

    await alert.present();
  }
}
