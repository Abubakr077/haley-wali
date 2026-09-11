import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { suggestSellingPrice } from "../modules/catalog-import/pricing.ts";
import {
  D1CatalogRepository,
  type D1DatabaseLike,
} from "../modules/catalog-import/repository.ts";
import {
  fetchShopifyCollection,
  normalizeShopifyProduct,
} from "../modules/catalog-import/shopify.ts";
import { runSupplierSync } from "../modules/catalog-import/sync.ts";
import type {
  CatalogRepository,
  SupplierProduct,
  SupplierSource,
  SyncCounts,
} from "../modules/catalog-import/types.ts";

const source: SupplierSource = {
  id: "supplier-a",
  name: "Supplier A",
  baseUrl: "https://example.com",
  collectionHandle: "new-arrival",
};

const shopifyProduct = {
  id: 101,
  handle: "wania-3pc",
  title: "Wania - 3pc",
  body_html: "<p>Embroidered ready to wear suit.</p>",
  updated_at: "2026-07-24T09:00:00+05:00",
  images: [{ src: "https://cdn.example.com/wania.jpg" }],
  variants: [
    {
      id: 201,
      title: "Small",
      price: "6590.00",
      compare_at_price: null,
      available: true,
      sku: "WA-S",
    },
    {
      id: 202,
      title: "Medium",
      price: "6690.00",
      compare_at_price: "7990.00",
      available: false,
      sku: "WA-M",
    },
  ],
};

test("normalizes a Shopify article and chooses an available price", () => {
  const product = normalizeShopifyProduct(shopifyProduct, source);
  assert.equal(product.title, "Wania - 3pc");
  assert.equal(product.sourcePricePkr, 6590);
  assert.equal(product.compareAtPricePkr, null);
  assert.equal(product.available, true);
  assert.equal(product.sourceUrl, "https://example.com/products/wania-3pc");
  assert.equal(product.gallery[0], "https://cdn.example.com/wania.jpg");
  assert.match(product.contentHash, /^[a-f0-9]{8}$/);
});

test("fetches the public Shopify collection feed", async () => {
  let requestedUrl = "";
  const fetchImpl = async (input: string | URL | Request) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ products: [shopifyProduct] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const products = await fetchShopifyCollection(source, fetchImpl as typeof fetch);
  assert.equal(products.length, 1);
  assert.match(requestedUrl, /collections\/new-arrival\/products\.json/);
  assert.match(requestedUrl, /limit=250/);
});

test("calculates gross-margin pricing and rounds up to PKR 50", () => {
  const result = suggestSellingPrice({
    costPricePkr: 4000,
    overheadPkr: 250,
    targetMarginBps: 2500,
  });
  assert.deepEqual(result, {
    sellingPricePkr: 5700,
    totalCostPkr: 4250,
    grossProfitPkr: 1450,
    grossMarginBps: 2544,
  });
});

class MemoryRepository implements CatalogRepository {
  products = new Map<string, SupplierProduct>();
  finished:
    | { status: "completed" | "failed"; counts: SyncCounts; error?: string }
    | undefined;

  async ensureSupplier() {}
  async beginRun() {}
  async markMissingUnavailable() {}
  async upsertSupplierProduct(
    _source: SupplierSource,
    product: SupplierProduct,
  ) {
    const existing = this.products.get(product.externalId);
    this.products.set(product.externalId, product);
    if (!existing) return "inserted" as const;
    return existing.contentHash === product.contentHash
      ? ("unchanged" as const)
      : ("updated" as const);
  }
  async finishRun(
    _runId: string,
    status: "completed" | "failed",
    counts: SyncCounts,
    _finishedAt: string,
    error?: string,
  ) {
    this.finished = { status, counts, error };
  }
}

test("imports all collection articles in one tracked run", async () => {
  const repository = new MemoryRepository();
  const fetchImpl = async () =>
    new Response(JSON.stringify({ products: [shopifyProduct] }), { status: 200 });
  const counts = await runSupplierSync({
    source,
    repository,
    fetchImpl: fetchImpl as typeof fetch,
    now: () => new Date("2026-07-24T10:00:00.000Z"),
    runId: "supplier-a:test",
  });
  assert.deepEqual(counts, {
    discovered: 1,
    inserted: 1,
    updated: 0,
    unchanged: 0,
  });
  assert.equal(repository.products.size, 1);
  assert.equal(repository.finished?.status, "completed");
});

function createSqliteD1Adapter(database: DatabaseSync): D1DatabaseLike {
  return {
    prepare(query: string) {
      let values: unknown[] = [];
      return {
        bind(...nextValues: unknown[]) {
          values = nextValues;
          return this;
        },
        async run() {
          database.prepare(query).run(...values);
          return { success: true };
        },
        async first<T>() {
          return (database.prepare(query).get(...values) as T | undefined) ?? null;
        },
      };
    },
  };
}

test("creates a draft and preserves Haley Wali pricing on supplier refresh", async () => {
  const database = new DatabaseSync(":memory:");
  for (const migrationName of ["0000_haley_wali_catalog.sql", "0001_store_lifecycle.sql"]) {
    const migration = readFileSync(
      new URL(`../drizzle/${migrationName}`, import.meta.url),
      "utf8",
    );
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) database.exec(statement);
    }
  }

  const repository = new D1CatalogRepository(createSqliteD1Adapter(database));
  const fetchFirst = async () =>
    new Response(JSON.stringify({ products: [shopifyProduct] }), { status: 200 });
  await runSupplierSync({
    source,
    repository,
    fetchImpl: fetchFirst as typeof fetch,
    now: () => new Date("2026-07-24T10:00:00.000Z"),
    runId: "supplier-a:first",
  });

  const draft = database
    .prepare(
      `SELECT pricing_status, publish_status, cost_price_pkr, selling_price_pkr
       FROM catalog_products`,
    )
    .get() as Record<string, unknown>;
  assert.deepEqual({ ...draft }, {
    pricing_status: "awaiting_cost",
    publish_status: "draft",
    cost_price_pkr: null,
    selling_price_pkr: null,
  });

  database
    .prepare(
      `UPDATE catalog_products
       SET cost_price_pkr = 4000, selling_price_pkr = 5700,
           pricing_status = 'approved', publish_status = 'published'`,
    )
    .run();
  const changedProduct = {
    ...shopifyProduct,
    title: "Wania - 3pc (updated)",
    variants: [{ ...shopifyProduct.variants[0], price: "6790.00" }],
  };
  const fetchChanged = async () =>
    new Response(JSON.stringify({ products: [changedProduct] }), { status: 200 });
  await runSupplierSync({
    source,
    repository,
    fetchImpl: fetchChanged as typeof fetch,
    now: () => new Date("2026-07-24T16:00:00.000Z"),
    runId: "supplier-a:second",
  });

  const afterRefresh = database
    .prepare(
      `SELECT cp.cost_price_pkr, cp.selling_price_pkr, cp.publish_status,
              sp.source_price_pkr
       FROM catalog_products cp
       JOIN supplier_products sp ON sp.id = cp.supplier_product_id`,
    )
    .get() as Record<string, unknown>;
  assert.deepEqual({ ...afterRefresh }, {
    cost_price_pkr: 4000,
    selling_price_pkr: 5700,
    publish_status: "published",
    source_price_pkr: 6790,
  });
});
