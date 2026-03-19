export type MeasureUnit = 'ud' | 'kg' | 'g' | 'l' | 'ml' | 'oz' | 'lb';

export type ProductCategory =
  | 'frutas'
  | 'verduras'
  | 'carnes'
  | 'pescados'
  | 'lácteos'
  | 'panadería'
  | 'bebidas'
  | 'limpieza'
  | 'higiene'
  | 'congelados'
  | 'otros';

export const MEASURE_UNITS: {
  value: MeasureUnit;
  label: string;
  icon: string;
}[] = [
  { value: 'ud', label: 'Unidades', icon: 'cube-outline' },
  { value: 'kg', label: 'Kilogramos', icon: 'barbell-outline' },
  { value: 'g', label: 'Gramos', icon: 'barbell-outline' },
  { value: 'l', label: 'Litros', icon: 'water-outline' },
  { value: 'ml', label: 'Mililitros', icon: 'water-outline' },
  { value: 'oz', label: 'Onzas', icon: 'barbell-outline' },
  { value: 'lb', label: 'Libras', icon: 'barbell-outline' },
];

export const PRODUCT_CATEGORIES: {
  value: ProductCategory;
  label: string;
  icon: string;
  color: string;
}[] = [
  {
    value: 'frutas',
    label: 'Frutas',
    icon: 'nutrition-outline',
    color: '#ff6b6b',
  },
  {
    value: 'verduras',
    label: 'Verduras',
    icon: 'leaf-outline',
    color: '#51cf66',
  },
  { value: 'carnes', label: 'Carnes', icon: 'flame-outline', color: '#e8590c' },
  {
    value: 'pescados',
    label: 'Pescados',
    icon: 'fish-outline',
    color: '#339af0',
  },
  {
    value: 'lácteos',
    label: 'Lácteos',
    icon: 'water-outline',
    color: '#ffd43b',
  },
  {
    value: 'panadería',
    label: 'Panadería',
    icon: 'assets/icons/bread.svg',
    color: '#e67700',
  },
  {
    value: 'bebidas',
    label: 'Bebidas',
    icon: 'beer-outline',
    color: '#845ef7',
  },
  {
    value: 'limpieza',
    label: 'Limpieza',
    icon: 'sparkles-outline',
    color: '#20c997',
  },
  {
    value: 'higiene',
    label: 'Higiene',
    icon: 'heart-outline',
    color: '#f06595',
  },
  {
    value: 'congelados',
    label: 'Congelados',
    icon: 'snow-outline',
    color: '#74c0fc',
  },
  {
    value: 'otros',
    label: 'Otros',
    icon: 'ellipsis-horizontal-outline',
    color: '#868e96',
  },
];

export interface Product {
  name: string;
  checked: boolean;
  quantity: number;
  urgent: boolean;
  unit: MeasureUnit;
  category: ProductCategory;
}
