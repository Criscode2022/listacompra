import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { DataService } from 'src/app/core/services/data-service/data.service';
import { SettingsService } from 'src/app/core/services/settings-service/settings.service';
import { HeaderComponent } from 'src/app/layout/header/header.component';

@Component({
  selector: 'app-tab-list',
  templateUrl: 'tab-list.page.html',
  styleUrls: ['tab-list.page.scss'],
  standalone: true,
  imports: [
    RouterModule,
    CommonModule,
    FormsModule,
    IonicModule,
    HeaderComponent,
  ],
})
export class TabList {
  protected dataService = inject(DataService);
  protected settingsService = inject(SettingsService);

  protected pendingProducts = computed(() => {
    return this.dataService
      .products()
      .filter((product) => !product.checked && !product.urgent);
  });

  protected groupedPending = computed(() => {
    const products = this.pendingProducts();
    const groups: Record<string, typeof products> = {};
    for (const product of products) {
      const cat = product.category || 'Sin categoría';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(product);
    }
    return groups;
  });

  protected groupKeys = computed(() => {
    return Object.keys(this.groupedPending());
  });

  protected estimatedTotal = computed(() => {
    return this.pendingProducts().reduce((total, product) => {
      return total + (product.price || 0) * product.quantity;
    }, 0);
  });
}
