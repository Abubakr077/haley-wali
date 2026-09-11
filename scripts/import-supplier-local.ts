import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import {
  D1CatalogRepository,
  type D1DatabaseLike,
} from "../modules/catalog-import/repository.ts";
import { runSupplierSync } from "../modules/catalog-import/sync.ts";

const projectRoot = new URL("../", import.meta.url);
const dataDirectory = new URL(".data/", projectRoot);
const databaseUrl = new URL("haley-wali.db", dataDirectory);
const previewDataUrl = new URL(
  "modules/catalog-import/imported-products.json",
  projectRoot,
);

function createD1Adapter(database: DatabaseSync): D1DatabaseLike {
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

await mkdir(dataDirectory, { recursive: true });
const database = new DatabaseSync(databaseUrl);
database.exec("PRAGMA foreign_keys = ON");

const tables = database
  .prepare(
    `SELECT COUNT(*) AS count
     FROM sqlite_master
     WHERE type = 'table' AND name = 'supplier_products'`,
  )
  .get() as { count: number };

if (tables.count === 0) {
  const migration = await readFile(
    new URL("../drizzle/0000_haley_wali_catalog.sql", import.meta.url),
    "utf8",
  );
  for (const statement of migration.split("--> statement-breakpoint")) {
    if (statement.trim()) database.exec(statement);
  }
}

const repository = new D1CatalogRepository(createD1Adapter(database));
const counts = await runSupplierSync({
  repository,
  runId: `chaudhary-arts:local:${randomUUID()}`,
});

const rows = database
  .prepare(
    `SELECT
       sp.external_id,
       sp.handle,
       sp.title,
       sp.source_price_pkr,
       sp.compare_at_price_pkr,
       sp.source_url,
       sp.image_url,
       sp.gallery_json,
       sp.variants_json,
       sp.source_available,
       sp.source_updated_at,
       cp.pricing_status,
       cp.publish_status
     FROM supplier_products sp
     JOIN catalog_products cp ON cp.supplier_product_id = sp.id
     ORDER BY sp.first_seen_at DESC, sp.title ASC`,
  )
  .all() as Record<string, unknown>[];

const importedAt = new Date().toISOString();
const payload = {
  importedAt,
  supplier: "Supplier A",
  count: rows.length,
  sync: counts,
  products: rows.map((row) => ({
    externalId: String(row.external_id),
    handle: String(row.handle),
    title: String(row.title),
    sourcePricePkr: Number(row.source_price_pkr),
    compareAtPricePkr:
      row.compare_at_price_pkr == null
        ? null
        : Number(row.compare_at_price_pkr),
    sourceUrl: String(row.source_url),
    imageUrl: row.image_url == null ? null : String(row.image_url),
    gallery: JSON.parse(String(row.gallery_json)),
    variants: JSON.parse(String(row.variants_json)),
    available: Boolean(row.source_available),
    sourceUpdatedAt:
      row.source_updated_at == null ? null : String(row.source_updated_at),
    pricingStatus: String(row.pricing_status),
    publishStatus: String(row.publish_status),
  })),
};

await writeFile(previewDataUrl, `${JSON.stringify(payload, null, 2)}\n`);
database.close();

console.log(
  `Imported ${counts.discovered} live supplier articles: ` +
    `${counts.inserted} new, ${counts.updated} updated, ` +
    `${counts.unchanged} unchanged.`,
);
console.log(`Saved ${payload.count} drafts for the pricing dashboard.`);
