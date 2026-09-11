import importedProducts from "./imported-products.json";

export type ImportedDraft = {
  handle: string;
  title: string;
  sourcePricePkr: number;
  compareAtPricePkr: number | null;
  sourceUrl: string;
  imageUrl: string;
  status: "awaiting_cost";
};

export const lastImportedAt = importedProducts.importedAt;

export const importedDrafts: ImportedDraft[] = importedProducts.products
  .filter((article) => Boolean(article.imageUrl))
  .map((article) => ({
    handle: article.handle,
    title: article.title,
    sourcePricePkr: article.sourcePricePkr,
    compareAtPricePkr: article.compareAtPricePkr,
    sourceUrl: article.sourceUrl,
    imageUrl: article.imageUrl as string,
    status: "awaiting_cost",
  }));
