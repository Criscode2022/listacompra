import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { DataService } from 'src/app/core/services/data-service/data.service';

@Component({
  selector: 'app-tab-list',
  templateUrl: 'tab-list.page.html',
  styleUrls: ['tab-list.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
})
export class TabList {
  private dataService = inject(DataService);

  products = this.dataService.products;

  ionViewWillEnter() {
    console.log('ionViewWillEnter');
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
}
