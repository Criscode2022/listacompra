import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AlertController, IonicModule } from '@ionic/angular';
import { DataService } from 'src/app/core/services/data-service/data.service';
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
  private snackbar = inject(MatSnackBar);

  protected products = this.dataService.products;

  protected pantryProducts = computed(() => {
    return this.products().filter((product) => !product.urgent);
  });

  protected async addProduct() {
    const alert = await this.alertController.create({
      header: 'Nuevo producto',
      inputs: [
        {
          name: 'productName',
          type: 'text',
          placeholder: 'Nombre',
          attributes: {
            maxlength: 30,
            required: true,
          },
        },
      ],
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
              },
            ]);

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

    await alert.present();
  }

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
