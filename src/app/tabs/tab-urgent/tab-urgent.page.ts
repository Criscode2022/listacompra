import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AlertController, IonicModule } from '@ionic/angular';
import { DataService } from 'src/app/core/services/data-service/data.service';
import { HeaderComponent } from 'src/app/layout/header/header.component';

@Component({
  selector: 'app-tab-urgent',
  templateUrl: 'tab-urgent.page.html',
  styleUrls: ['tab-urgent.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, HeaderComponent],
})
export class TabUrgent {
  private alertController = inject(AlertController);
  private dataService = inject(DataService);
  private snackbar = inject(MatSnackBar);

  protected products = this.dataService.products;

  protected urgentProducts = computed(() => {
    return this.products().filter((product) => product.urgent);
  });

  protected async handleToggleChange(productName: string) {
    this.products.update((products) => {
      return products.filter((product) => {
        return product.name !== productName;
      });
    });
  }

  protected async addProduct() {
    const alert = await this.alertController.create({
      header: 'Nuevo producto urgente',
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

            this.products.update((products) => {
              return [
                ...products,
                {
                  name: data.productName.trim(),
                  checked: false,
                  quantity: 1,
                  urgent: true,
                },
              ];
            });
            ('');

            this.snackbar.open(`Producto añadido correctamente`, 'Cerrar', {
              duration: 1500,
            });

            return true;
          },
        },
      ],
    });

    const enterListener = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        let addButton = document.querySelector(
          '.alert-wrapper .alert-button-group button:last-child'
        ) as HTMLElement;
        if (addButton) {
          addButton.click();
        }
      }
    };

    document.addEventListener('keyup', enterListener);

    await alert.present();
  }
}
