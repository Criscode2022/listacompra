import { Component, OnInit } from '@angular/core';
import { DataService } from '../data.service';
import { AlertController } from '@ionic/angular';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
})
export class Tab3Page implements OnInit {
  products: { name: string; checked: boolean }[] = [];
  urgentProducts: { name: string; checked: boolean }[] = []; // Añadimos la variable urgentProducts

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

  async fetchProducts() {
    this.products = await this.dataService.getProducts(false); // Aquí, pasamos false para obtener los productos no urgentes
    this.urgentProducts = await this.dataService.getProducts(true); // Rellenamos urgentProducts con los productos urgentes
    console.log('Productos obtenidos:', this.products, this.urgentProducts); // Nueva línea de logging
  }

  async handleToggleChange(productName: string, event: Event) {
    const customEvent = event as CustomEvent;
    if (customEvent.detail.checked) {
      await this.dataService.remove(productName, true); // Aquí, pasamos true para indicar que estamos eliminando un producto urgente
    } else {
      await this.dataService.set(productName, customEvent.detail.checked, true); // Aquí, pasamos true para indicar que estamos desmarcando un producto urgente
    }
    // Refresca la lista
    this.fetchProducts();
  }

  async addProduct() {
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
              // El producto está en blanco
              console.log('El producto está en blanco.');
              return false;
            }

            if (data.productName.trim().length > 30) {
              // El producto excede los 30 caracteres
              console.log('El producto excede los 30 caracteres.');
              return false;
            }

            await this.dataService.set(data.productName, false, true); // Aquí, pasamos true para indicar que estamos añadiendo un producto urgente
            this.fetchProducts();

            return true; // Indica que la adición del producto fue exitosa
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


}
