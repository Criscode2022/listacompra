import { Component, inject } from '@angular/core';
import { Product } from '../core/types/product';
import { DataService } from '../data.service';
@Component({
  selector: 'app-tab2-lista',
  templateUrl: 'tab2-lista.page.html',
  styleUrls: ['tab2-lista.page.scss'],
})
export class Tab2Page {
  products = [] as Product[];

  private dataService = inject(DataService);

  ionViewWillEnter() {
    this.refreshProducts();
  }

  private async refreshProducts() {
    this.products = (await this.dataService.getProducts()).filter(
      (product) => !product.checked
    );
  }

  protected async handleToggleChange(productName: string, event: Event) {
    const customEvent = event as CustomEvent;
    await this.dataService.set(productName, customEvent.detail.checked);

    this.refreshProducts();
  }
}
