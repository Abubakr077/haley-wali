export type ProductCategory = "exclusive" | "branded";

export type Product = {
  id: string;
  name: string;
  articleCode: string;
  title: string;
  brand: string;
  category: ProductCategory;
  categoryLabel: string;
  type: string;
  pieces: string;
  season: string;
  price: number;
  originalPrice?: number;
  salePercent?: number;
  saleName?: string;
  image: string;
  gallery?: string[];
  color: string;
  fabric: string;
  badge: string;
  sizes?: string[];
  stockQty: number;
  stockBySize?: Record<string, number>;
  reviewAverage: number;
  reviewCount: number;
  description: string;
  includes: string[];
  care: string;
  shirtDetails: string;
  trouserDetails: string;
  dupattaDetails: string;
  modelDetails: string;
  measurements: Array<{ label: string; value: string }>;
};

export type CartItem = {
  id: string;
  size: string;
  quantity: number;
  product: Product;
};
