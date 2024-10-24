import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertController, IonicModule } from '@ionic/angular';
import { DataService } from 'src/app/core/services/data-service/data.service';

@Component({
  selector: 'app-tab-urgent',
  templateUrl: 'tab-urgent.page.html',
  styleUrls: ['tab-urgent.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
})
export class TabUrgent {
  private alertController = inject(AlertController);
  private dataService = inject(DataService);

  protected products = this.dataService.products;

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
          placeholder: 'Nombre del producto',
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
              console.log('El producto está en blanco.');
              return false;
            }

            if (data.productName.trim().length > 30) {
              console.log('El producto excede los 30 caracteres.');
              return false;
            }

            const existingProducts = this.products();

            if (
              existingProducts.some(
                (product) => product.name === data.productName
              )
            ) {
              console.log('Product already exists:', data.productName);
              return false;
            }

            this.products.update((products) => {
              return [
                ...products,
                { name: data.productName.trim(), checked: false, urgent: true },
              ];
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
