import { Component } from '@angular/core';
import { DataService } from '../data.service';
@Component({
  selector: 'app-tab2-lista',
  templateUrl: 'tab2-lista.page.html',
  styleUrls: ['tab2-lista.page.scss'],
})
export class Tab2Page {
  products: { name: string; checked: boolean }[] = [];

  constructor(private dataService: DataService) {}

  ionViewWillEnter() {
    this.refreshProducts();
  }

  async handleToggleChange(productName: string, event: Event) {
    const customEvent = event as CustomEvent;
    await this.dataService.set(productName, customEvent.detail.checked);

    // Refresca la lista
    this.refreshProducts();
  }

  private async refreshProducts() {
    this.products = (await this.dataService.getProducts()).filter(
      (product) => !product.checked
    );
    console.log('Initialized with products: ', this.products);
  }
}
