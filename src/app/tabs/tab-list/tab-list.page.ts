import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { IonicModule, ModalController } from '@ionic/angular';
import jsPDF from 'jspdf';
import { DataService } from 'src/app/core/services/data-service/data.service';
import { matchesTextFilter } from 'src/app/core/utils/product-filter';
import {
  PRODUCT_CATEGORIES,
  ProductCategory,
} from 'src/app/core/types/product';
import { AddProductModalComponent } from 'src/app/layout/add-product-modal/add-product-modal.component';
import { EmptyStateComponent } from 'src/app/layout/empty-state/empty-state.component';
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
    EmptyStateComponent,
  ],
})
export class TabListPage {
  private modalController = inject(ModalController);
  private snackbar = inject(MatSnackBar);
  protected dataService = inject(DataService);
  protected categories = PRODUCT_CATEGORIES;
  protected selectedFilter = signal<ProductCategory | 'all'>('all');
  protected textFilter = signal('');

  protected tabProducts = computed(() => {
    const filter = this.selectedFilter();
    return this.dataService.products().filter((product) => {
      if (product.checked || product.urgent) return false;
      if (filter !== 'all' && product.category !== filter) return false;
      return true;
    });
  });

  protected pendingProducts = computed(() => {
    const query = this.textFilter();
    return this.tabProducts().filter((product) =>
      matchesTextFilter(product.name, query),
    );
  });

  protected heroSubtitle = computed(() => {
    const pending = this.dataService
      .products()
      .filter((product) => !product.checked && !product.urgent);
    if (!pending.length) {
      return 'Nada pendiente de comprar';
    }
    return `${pending.length} producto${pending.length === 1 ? '' : 's'} en la lista`;
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

  protected updateTextFilter(event: CustomEvent<{ value?: string | null }>) {
    this.textFilter.set(event.detail?.value ?? '');
  }

  protected async addProduct() {
    const isDesktop =
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 768px)').matches;

    const modal = await this.modalController.create({
      component: AddProductModalComponent,
      componentProps: { isUrgent: false },
      cssClass: 'add-product-modal',
      ...(isDesktop
        ? {}
        : {
            breakpoints: [0, 1],
            initialBreakpoint: 1,
            handle: false,
          }),
    });

    await modal.present();
    const { data, role } = await modal.onWillDismiss();

    if (role !== 'confirm' || !data) return;

    const existingProducts = this.dataService.products();
    if (
      existingProducts.some(
        (product) => product.name.toLowerCase() === data.name.toLowerCase(),
      )
    ) {
      this.snackbar.open(`Producto ya existente`, 'Cerrar', {
        duration: 3000,
      });
      return;
    }

    this.dataService.products.update((products) => [
      ...products,
      {
        name: data.name,
        checked: false,
        quantity: data.quantity,
        urgent: false,
        unit: data.unit,
        category: data.category,
      },
    ]);

    this.snackbar.open(`Producto añadido a la lista`, 'Cerrar', {
      duration: 1500,
    });
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

  protected exportToPdf() {
    const products = this.pendingProducts();
    if (!products.length) return;

    // Group products by category
    const grouped: { [key: string]: typeof products } = {};
    for (const cat of this.categories) {
      const catProducts = products.filter((p) => p.category === cat.value);
      if (catProducts.length > 0) {
        grouped[cat.label] = catProducts;
      }
    }

    // Create PDF with A4 size
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;
    const lineHeight = 7;
    const checkboxSize = 4;

    let yPos = margin + 5;

    // Title
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Lista de la compra', margin, yPos);

    // Date on top right
    const now = new Date();
    const today = now.toLocaleDateString('es-ES');
    const fileDate = now.toISOString().slice(0, 10);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text(today, pageWidth - margin, yPos, { align: 'right' });
    yPos += lineHeight + 8;

    // Categories and products
    for (const [categoryName, categoryProducts] of Object.entries(grouped)) {
      // Category header
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');

      // Check if we need a new page
      if (yPos > pageHeight - 20) {
        pdf.addPage();
        yPos = margin;
      }

      pdf.text(categoryName, margin + 2, yPos);
      yPos += lineHeight + 2;

      // Products in category
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');

      for (const product of categoryProducts) {
        // Check if we need a new page
        if (yPos > pageHeight - 10) {
          pdf.addPage();
          yPos = margin;
        }

        // Checkbox (draw a small square)
        const checkboxX = margin + 1;
        const checkboxY = yPos - 2.5;
        pdf.rect(checkboxX, checkboxY, checkboxSize, checkboxSize);

        // Product name and quantity
        const productText = `${product.name} (${product.quantity}${product.unit})`;
        pdf.text(productText, margin + checkboxSize + 3, yPos);

        yPos += lineHeight;
      }

      yPos += 2;
    }

    // Save PDF
    pdf.save(`lista-compra-${fileDate}.pdf`);
  }
}
