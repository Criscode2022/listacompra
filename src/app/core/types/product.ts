export interface Product {
  name: string;
  checked: boolean;
  quantity: number;
  urgent: boolean;
  category?: string;
  price?: number;
  notes?: string;
}
