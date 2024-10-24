import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertController, IonicModule } from '@ionic/angular';
import { DataService } from '../../../core/services/data-service/data.service';
import { Product } from '../../../core/types/product';

@Component({
  selector: 'app-tab-pantry',
  templateUrl: 'tab-pantry.page.html',
  styleUrls: ['tab-pantry.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
})
export class TabPantry implements OnInit {
  products = [] as Product[];

  private alertController = inject(AlertController);
  private dataService = inject(DataService);

  ngOnInit(): void {
    this.dataService.productsUpdated.subscribe(() => {
      this.fetchProducts();
    });

    this.dataService.storageInitialized.subscribe(() => {
      this.fetchProducts();
    });
  }

  private async fetchProducts() {
    this.products = await this.dataService.getProducts(false);
    console.log('Productos obtenidos:', this.products);
  }

  protected async handleToggleChange(productName: string, event: Event) {
    const customEvent = event as CustomEvent;
    const isChecked = customEvent.detail.checked;
    await this.dataService.set(productName, isChecked, false);
  }

  protected async addProduct() {
    const alert = await this.alertController.create({
      header: 'Nuevo producto',
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
              return false;
            }

            if (data.productName.trim().length > 30) {
              return false;
            }

            await this.dataService.set(data.productName, true, false);
            this.fetchProducts();

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

    alert.onDidDismiss().then(() => {
      document.removeEventListener('keyup', enterListener);
    });
  }

  protected async deleteProduct(productName: string) {
    await this.dataService.delete(productName, false);
    this.fetchProducts();
  }

  protected async clearStorage() {
    const alert = await this.alertController.create({
      header: 'Confirmar borrado',
      message:
        '¿Seguro que quieres borrar todos los productos? Si solo quieres eliminar un producto puedes deslizarlo hacia la izquierda',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Borrar',
          handler: () => {
            this.dataService.clearStorage();
          },
        },
      ],
    });

    await alert.present();
  }
}
