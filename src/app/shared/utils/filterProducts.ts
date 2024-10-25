import { Product } from 'src/app/core/types/product';

export function hasProductsByCondition(
  products: Product[],
  condition: 'urgent' | 'pending' | 'pantry'
): boolean {
  switch (condition) {
    case 'urgent':
      return products.some((product: Product) => product.urgent);
    case 'pending':
      return products.some(
        (product: Product) => !product.checked && !product.urgent
      );
    case 'pantry':
      return products.some((product: Product) => !product.urgent);
    default:
      return false;
  }
}
