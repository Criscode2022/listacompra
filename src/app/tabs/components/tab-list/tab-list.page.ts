import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { DataService } from 'src/app/core/services/data-service/data.service';
import { Product } from 'src/app/core/types/product';

@Component({
  selector: 'app-tab-list',
  templateUrl: 'tab-list.page.html',
  styleUrls: ['tab-list.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
})
export class TabList {
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
