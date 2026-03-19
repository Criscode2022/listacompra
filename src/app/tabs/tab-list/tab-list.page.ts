import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { DataService } from 'src/app/core/services/data-service/data.service';
import {
  PRODUCT_CATEGORIES,
  ProductCategory,
} from 'src/app/core/types/product';
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
  protected categories = PRODUCT_CATEGORIES;
  protected selectedFilter = signal<ProductCategory | 'all'>('all');

  protected pendingProducts = computed(() => {
    const filter = this.selectedFilter();
    return this.dataService.products().filter((product) => {
      if (product.checked || product.urgent) return false;
      if (filter !== 'all' && product.category !== filter) return false;
      return true;
    });
  });

  protected categoryCounts = computed(() => {
    const pending = this.dataService
      .products()
      .filter((product) => !product.checked && !product.urgent);
    const counts: Record<string, number> = { all: pending.length };
    for (const cat of this.categories) {
      counts[cat.value] = pending.filter(
        (p) => p.category === cat.value,
      ).length;
    }
    return counts;
  });

  protected setFilter(category: ProductCategory | 'all') {
    this.selectedFilter.set(category);
  }

  protected getCategoryColor(category: string): string {
    return (
      this.categories.find((c) => c.value === category)?.color ?? '#868e96'
    );
  }

  protected isAssetIcon(icon: string): boolean {
    return icon.startsWith('assets/');
  }

  protected getCategoryIconName(category: string): string | undefined {
    const icon =
      this.categories.find((c) => c.value === category)?.icon ??
      'ellipsis-horizontal-outline';
    return this.isAssetIcon(icon) ? undefined : icon;
  }

  protected getCategoryIconSrc(category: string): string | undefined {
    const icon =
      this.categories.find((c) => c.value === category)?.icon ??
      'ellipsis-horizontal-outline';
    return this.isAssetIcon(icon) ? icon : undefined;
  }
}
