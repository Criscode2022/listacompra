import { CommonModule } from '@angular/common';
import { Component, effect, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertController, IonicModule } from '@ionic/angular';
import { DataService } from 'src/app/core/services/data-service/data.service';
import { Product } from 'src/app/core/types/product';
import { HeaderComponent } from '../layout/header/header/header.component';

@Component({
  selector: 'app-tab-pantry',
  templateUrl: 'tab-pantry.page.html',
  styleUrls: ['tab-pantry.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, HeaderComponent],
})
export class TabPantry implements OnInit {
  private alertController = inject(AlertController);
  protected dataService = inject(DataService);

  protected products = this.dataService.products;

  protected hasPantryProducts = (products: Product[]): boolean => {
    return products.some((product: any) => !product.urgent);
  };

  constructor() {
    effect(() => {
      if (this.products().length) {
        this.hasPantryProducts(this.products());
      }
    });
  }

  ngOnInit(): void {
    this.dataService.storageInitialized.subscribe(() => {});
  }

  protected async handleToggleChange(productName: string) {
    this.products.update((products) => {
      return products.map((p) => {
        if (p.name === productName) {
          p.checked = !p.checked;
        }
        return p;
      });
    });
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

            const existingProducts = this.products();

            if (
              existingProducts.some(
                (product) => product.name === data.productName
              )
            ) {
              console.log('Product already exists:', data.productName);
              return false;
            }

            this.products.update((products) => [
              ...products,
              {
                name: data.productName.trim(),
                checked: false,
                urgent: false,
              },
            ]);

            console.log('Added product:', data.productName);
            console.log('Products:', this.products());

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