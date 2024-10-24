import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertController, IonicModule } from '@ionic/angular';
import { DataService } from '../../../core/services/data-service/data.service';

@Component({
  selector: 'app-tab-urgent',
  templateUrl: 'tab-urgent.page.html',
  styleUrls: ['tab-urgent.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
})
export class TabUrgent implements OnInit {
  private dataService = inject(DataService);
  private alertController = inject(AlertController);

  private products = [] as any[];
  protected urgentProducts = [] as any[];

  ngOnInit(): void {
    this.dataService.storageInitialized.subscribe(() => {
      this.fetchProducts();
    });
  }

  private async fetchProducts() {
    this.products = await this.dataService.getProducts(false);
    this.urgentProducts = await this.dataService.getProducts(true);
    console.log('Productos obtenidos:', this.products, this.urgentProducts);
  }

  protected async handleToggleChange(productName: string, event: Event) {
    const customEvent = event as CustomEvent;
    if (customEvent.detail.checked) {
      await this.dataService.delete(productName, true);
    } else {
      await this.dataService.storeData(productName);
    }

    this.fetchProducts();
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
}
