export type SupplierSource = {
  id: string;
  name: string;
  baseUrl: string;
  collectionHandle: string;
};

export type SupplierVariant = {
  externalId: string;
  title: string;
  pricePkr: number;
  compareAtPricePkr: number | null;
  available: boolean;
  sku: string | null;
};

export type SupplierProduct = {
  externalId: string;
  handle: string;
  title: string;
  descriptionHtml: string;
  sourceUrl: string;
  sourcePricePkr: number;
  compareAtPricePkr: number | null;
  imageUrl: string | null;
  gallery: string[];
  variants: SupplierVariant[];
  available: boolean;
  sourceUpdatedAt: string | null;
  contentHash: string;
};

export type SyncCounts = {
  discovered: number;
  inserted: number;
  updated: number;
  unchanged: number;
};

export type CatalogRepository = {
  ensureSupplier(source: SupplierSource, now: string): Promise<void>;
  beginRun(runId: string, source: SupplierSource, now: string): Promise<void>;
  upsertSupplierProduct(
    source: SupplierSource,
    product: SupplierProduct,
    now: string,
  ): Promise<"inserted" | "updated" | "unchanged">;
  markMissingUnavailable(source: SupplierSource, seenAt: string): Promise<void>;
  finishRun(
    runId: string,
    status: "completed" | "failed",
    counts: SyncCounts,
    finishedAt: string,
    errorMessage?: string,
  ): Promise<void>;
};
