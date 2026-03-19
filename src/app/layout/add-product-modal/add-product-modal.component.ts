import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import {
  MEASURE_UNITS,
  MeasureUnit,
  PRODUCT_CATEGORIES,
  ProductCategory,
} from '../../core/types/product';

@Component({
  selector: 'app-add-product-modal',
  templateUrl: './add-product-modal.component.html',
  styleUrls: ['./add-product-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
})
export class AddProductModalComponent {
  @Input() isUrgent = false;

  private modalController = inject(ModalController);

  protected measureUnits = MEASURE_UNITS;
  protected categories = PRODUCT_CATEGORIES;

  protected productName = '';
  protected quantity = 1;
  protected selectedUnit: MeasureUnit = 'ud';
  protected selectedCategory: ProductCategory = 'otros';

  get title(): string {
    return this.isUrgent ? 'Nuevo producto urgente' : 'Nuevo producto';
  }

  get accentColor(): string {
    return this.isUrgent ? '#f06595' : '#228be6';
  }

  protected selectUnit(unit: MeasureUnit) {
    this.selectedUnit = unit;
  }

  protected selectCategory(category: ProductCategory) {
    this.selectedCategory = category;
  }

  protected getCategoryColor(cat: ProductCategory): string {
    return this.categories.find((c) => c.value === cat)?.color ?? '#868e96';
  }

  protected isAssetIcon(icon: string): boolean {
    return icon.startsWith('assets/');
  }

  protected dismiss() {
    this.modalController.dismiss(null, 'cancel');
  }

  protected confirm() {
    if (!this.productName.trim()) return;

    this.modalController.dismiss(
      {
        name: this.productName.trim(),
        quantity: this.quantity,
        unit: this.selectedUnit,
        category: this.selectedCategory,
      },
      'confirm',
    );
  }

  protected adjustQuantity(delta: number) {
    const newVal = this.quantity + delta;
    if (newVal >= 1 && newVal <= 999) {
      this.quantity = newVal;
    }
  }

  protected onEnterKey(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.confirm();
    }
  }
}
