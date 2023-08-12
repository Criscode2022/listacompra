import { Component, OnInit } from '@angular/core';
import { DataService } from '../data.service';
import { AlertController } from '@ionic/angular';

@Component({
  selector: 'app-tab1-despensa',
  templateUrl: 'tab1-despensa.page.html',
  styleUrls: ['tab1-despensa.page.scss'],
})
export class Tab1Page implements OnInit {
  products: { name: string; checked: boolean }[] = [];

  constructor(
    private dataService: DataService,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.dataService.productsUpdated.subscribe(() => {
      this.fetchProducts();
    });
    this.dataService.storageInitialized.subscribe(() => {
      this.fetchProducts();
    });
  }

  async deleteProduct(productName: string) {
    await this.dataService.remove(productName, false); // false indica que es un producto no urgente
    this.fetchProducts();
  }

  async fetchProducts() {
    this.products = await this.dataService.getProducts(false);
    console.log('Productos obtenidos:', this.products);
  }

  async handleToggleChange(productName: string, event: Event) {
    const customEvent = event as CustomEvent;
    const isChecked = customEvent.detail.checked;
    await this.dataService.set(productName, isChecked, false);
  }

  async addProduct() {
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
              // El producto está en blanco
              console.log('El producto está en blanco.');
              return false;
            }

            if (data.productName.trim().length > 30) {
              // El producto excede los 30 caracteres
              console.log('El producto excede los 30 caracteres.');
              return false;
            }

            await this.dataService.set(data.productName, true, false);
            this.fetchProducts();

            return true; // Confirmación de adicción
          },
        },
      ],
    });

    //Event listener para añadir productos pulsando la tecla "Enter"
    const enterListener = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        let addButton = document.querySelector('.alert-wrapper .alert-button-group button:last-child') as HTMLElement;
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



  async clearStorage() {
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
            this.dataService.clear();
          },
        },
      ],
    });



    await alert.present();
  }
}
