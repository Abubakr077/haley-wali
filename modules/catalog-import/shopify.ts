import type {
  SupplierProduct,
  SupplierSource,
  SupplierVariant,
} from "./types.ts";

type ShopifyImage = { src?: string };
type ShopifyVariant = {
  id: number | string;
  title?: string;
  price?: string;
  compare_at_price?: string | null;
  available?: boolean;
  sku?: string | null;
};
type ShopifyProduct = {
  id: number | string;
  handle?: string;
  title?: string;
  body_html?: string;
  updated_at?: string;
  images?: ShopifyImage[];
  variants?: ShopifyVariant[];
};
type ShopifyCollectionResponse = { products?: ShopifyProduct[] };

function parsePkr(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) ? Math.round(amount) : null;
}

export function fingerprintProduct(
  product: Omit<SupplierProduct, "contentHash">,
): string {
  const input = JSON.stringify(product);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function normalizeShopifyProduct(
  product: ShopifyProduct,
  source: SupplierSource,
): SupplierProduct {
  const handle = product.handle?.trim();
  const title = product.title?.trim();
  if (!handle || !title) {
    throw new Error(`Supplier product ${String(product.id)} is missing a handle or title.`);
  }

  const variants: SupplierVariant[] = (product.variants ?? [])
    .map((variant) => {
      const pricePkr = parsePkr(variant.price);
      if (pricePkr == null) return null;
      return {
        externalId: String(variant.id),
        title: variant.title?.trim() || "Default",
        pricePkr,
        compareAtPricePkr: parsePkr(variant.compare_at_price),
        available: variant.available !== false,
        sku: variant.sku?.trim() || null,
      };
    })
    .filter((variant): variant is SupplierVariant => variant !== null);

  if (!variants.length) {
    throw new Error(`Supplier product ${String(product.id)} has no priced variants.`);
  }

  const availableVariants = variants.filter((variant) => variant.available);
  const pricePool = availableVariants.length ? availableVariants : variants;
  const sourcePricePkr = Math.min(...pricePool.map((variant) => variant.pricePkr));
  const comparePrices = pricePool
    .map((variant) => variant.compareAtPricePkr)
    .filter((price): price is number => price != null);
  const gallery = (product.images ?? [])
    .map((image) => image.src?.trim())
    .filter((src): src is string => Boolean(src));

  const normalized = {
    externalId: String(product.id),
    handle,
    title,
    descriptionHtml: product.body_html ?? "",
    sourceUrl: new URL(`/products/${handle}`, source.baseUrl).href,
    sourcePricePkr,
    compareAtPricePkr: comparePrices.length ? Math.max(...comparePrices) : null,
    imageUrl: gallery[0] ?? null,
    gallery,
    variants,
    available: variants.some((variant) => variant.available),
    sourceUpdatedAt: product.updated_at ?? null,
  };

  return { ...normalized, contentHash: fingerprintProduct(normalized) };
}

export async function fetchShopifyCollection(
  source: SupplierSource,
  fetchImpl: typeof fetch = fetch,
): Promise<SupplierProduct[]> {
  const url = new URL(
    `/collections/${source.collectionHandle}/products.json`,
    source.baseUrl,
  );
  url.searchParams.set("limit", "250");

  const response = await fetchImpl(url, {
    headers: {
      accept: "application/json",
      "user-agent": "HaleyWaliCatalogSync/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`Supplier feed returned HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as ShopifyCollectionResponse;
  const products = payload.products ?? [];
  return products.map((product) => normalizeShopifyProduct(product, source));
}
