import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AlertController, IonicModule } from '@ionic/angular';
import { DataService } from 'src/app/core/services/data-service/data.service';
import {
  SettingsService,
  CATEGORIES,
} from 'src/app/core/services/settings-service/settings.service';
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
  private alertController = inject(AlertController);
  protected dataService = inject(DataService);
  protected settingsService = inject(SettingsService);
  private snackbar = inject(MatSnackBar);

  protected products = this.dataService.products;

  protected pantryProducts = computed(() => {
    return this.products().filter((product) => !product.urgent);
  });

  protected groupedProducts = computed(() => {
    const products = this.pantryProducts();
    const groups: Record<string, typeof products> = {};
    for (const product of products) {
      const cat = product.category || 'Sin categoría';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(product);
    }
    return groups;
  });

  protected groupKeys = computed(() => {
    return Object.keys(this.groupedProducts());
  });

  protected async addProduct() {
    const isAdvanced = this.settingsService.isAdvanced();

    const inputs: any[] = [
      {
        name: 'productName',
        type: 'text',
        placeholder: 'Nombre',
        attributes: {
          maxlength: 30,
          required: true,
        },
      },
    ];

    if (isAdvanced) {
      inputs.push(
        {
          name: 'productPrice',
          type: 'number',
          placeholder: 'Precio (€)',
          min: 0,
          attributes: {
            step: '0.01',
          },
        },
        {
          name: 'productNotes',
          type: 'text',
          placeholder: 'Notas (opcional)',
          attributes: {
            maxlength: 100,
          },
        }
      );
    }

    const alert = await this.alertController.create({
      header: 'Nuevo producto',
      inputs,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Añadir',
          handler: async (data) => {
            if (!data.productName.trim()) {
              return false;
            }

            if (data.productName.trim().length > 30) {
              return false;
            }

            const existingProducts = this.products();

            if (
              existingProducts.some(
                (product) => product.name === data.productName
              )
            ) {
              this.snackbar.open(`Producto ya existente`, 'Cerrar', {
                duration: 3000,
              });

              return false;
            }

            this.products.update((products) => [
              ...products,
              {
                name: data.productName.trim(),
                checked: false,
                quantity: 1,
                urgent: false,
                ...(isAdvanced && {
                  category: this.selectedCategory,
                  price: data.productPrice
                    ? parseFloat(data.productPrice)
                    : undefined,
                  notes: data.productNotes?.trim() || undefined,
                }),
              },
            ]);

            this.selectedCategory = 'Sin categoría';

            this.snackbar.open(`Producto añadido correctamente`, 'Cerrar', {
              duration: 1500,
            });

            return true;
          },
        },
      ],
    });

    const enterListener = async (event: KeyboardEvent): Promise<boolean> => {
      if (event.key === 'Enter') {
        let addButton = document.querySelector(
          '.alert-wrapper .alert-button-group button:last-child'
        ) as HTMLElement;
        if (addButton) {
          await addButton.click();
          return false;
        }
      }
      return true;
    };

    document.addEventListener('keydown', enterListener);

    // If advanced mode, add category selector after alert renders
    if (isAdvanced) {
      alert.addEventListener('didPresent', () => {
        const alertWrapper = document.querySelector('.alert-wrapper');
        if (alertWrapper) {
          const inputGroup = alertWrapper.querySelector('.alert-input-group');
          if (inputGroup) {
            const selectContainer = document.createElement('div');
            selectContainer.style.cssText =
              'padding: 0 16px; margin-bottom: 8px;';
            const select = document.createElement('select');
            select.style.cssText =
              'width: 100%; padding: 10px 16px; border: 1px solid #ccc; border-radius: 8px; font-size: 16px; background: white; color: #333;';
            CATEGORIES.forEach((cat) => {
              const option = document.createElement('option');
              option.value = cat;
              option.textContent = cat;
              select.appendChild(option);
            });
            select.addEventListener('change', (e) => {
              this.selectedCategory = (e.target as HTMLSelectElement).value;
            });
            selectContainer.appendChild(select);
            inputGroup.appendChild(selectContainer);
          }
        }
      });
    }

    await alert.present();

    await alert.onDidDismiss();
    document.removeEventListener('keydown', enterListener);
  }

  private selectedCategory = 'Sin categoría';

  protected addQuantity(productName: string) {
    this.products.update((products) => {
      return products.map((product) => {
        if (product.name === productName) {
          product.quantity++;
          product.checked = false;
        }
        return product;
      });
    });
  }
}
