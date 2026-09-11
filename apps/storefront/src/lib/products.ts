import type { Product } from "./types";

// Production starts empty. Articles appear only after Store Manager publishes them.
export const products: Product[] = [];

export function formatPkr(value: number) {
  return `PKR ${value.toLocaleString("en-PK")}`;
}

export function findProduct(id: string) {
  return products.find((product) => product.id === id);
}

export async function fetchPublishedArticles(apiBase: string) {
  try {
    const response = await fetch(`${apiBase}/api/catalog/articles`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return [] as Product[];
    const result = (await response.json()) as { products?: PublishedArticle[] };
    return (result.products ?? []).map(mapPublishedArticle);
  } catch {
    return [] as Product[];
  }
}

export type PublishedArticle = {
  id: string;
  title: string;
  articleCode?: string;
  subtitle?: string;
  pricePkr: number;
  originalPricePkr?: number;
  salePercent?: number;
  saleName?: string;
  stockQty?: number;
  imageUrl: string | null;
  gallery?: string[];
  variants?: Array<{ title: string; available: boolean; stockQty?: number }>;
  brand?: string;
  collection?: "exclusive" | "branded";
  garmentType?: "pret" | "unstitched";
  pieces?: string;
  season?: string;
  description?: string;
  fabric?: string;
  color?: string;
  care?: string;
  shirtDetails?: string;
  trouserDetails?: string;
  dupattaDetails?: string;
  modelDetails?: string;
  measurements?: Array<{ label: string; value: string }>;
  includes?: string[];
};

export function mapPublishedArticle(article: PublishedArticle): Product {
  const variants = (article.variants ?? []).filter(
    (variant) => variant.available && !/^default title$/i.test(variant.title),
  );
  return {
    id: article.id,
    name: article.title,
    articleCode: article.articleCode || "",
    title: article.subtitle || (article.garmentType === "pret" ? "Ready to Wear Suit" : "Unstitched Suit"),
    brand: article.brand || "Haley Wali",
    category: article.collection || "exclusive",
    categoryLabel: article.collection === "branded" ? "Branded" : "HW Exclusive",
    type: article.garmentType === "pret" ? "Ready to Wear" : "Unstitched",
    pieces: article.pieces || "See article details",
    season: article.season || "All Season",
    price: article.pricePkr,
    originalPrice: article.originalPricePkr && article.originalPricePkr > article.pricePkr
      ? article.originalPricePkr
      : undefined,
    salePercent: article.salePercent,
    saleName: article.saleName,
    stockQty: Number(article.stockQty ?? 0),
    image: article.imageUrl ?? "/brand/haley-wali-logo.svg",
    gallery: article.gallery,
    color: article.color || "As shown",
    fabric: article.fabric || "See article details",
    badge: article.collection === "branded" ? "Branded" : "HW Exclusive",
    sizes: variants.length ? variants.map((variant) => variant.title) : undefined,
    stockBySize: Object.fromEntries(variants.map((variant) => [variant.title, Number(variant.stockQty ?? 0)])),
    description: article.description || "See article details.",
    includes: article.includes || [],
    care: article.care || "Follow the care instructions on the article.",
    shirtDetails: article.shirtDetails || "",
    trouserDetails: article.trouserDetails || "",
    dupattaDetails: article.dupattaDetails || "",
    modelDetails: article.modelDetails || "",
    measurements: article.measurements || [],
  };
}

export const mapPublishedPret = mapPublishedArticle;
