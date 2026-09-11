import type {
  CatalogRepository,
  SupplierProduct,
  SupplierSource,
  SyncCounts,
} from "./types.ts";

type D1Result = { success?: boolean };
type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  run<T = D1Result>(): Promise<T>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
};
export type D1DatabaseLike = {
  prepare(query: string): D1Statement;
};

export class D1CatalogRepository implements CatalogRepository {
  private readonly db: D1DatabaseLike;

  constructor(db: D1DatabaseLike) {
    this.db = db;
  }

  async ensureSupplier(source: SupplierSource): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO suppliers (id, name, base_url, collection_handle, active)
         VALUES (?, ?, ?, ?, 1)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           base_url = excluded.base_url,
           collection_handle = excluded.collection_handle,
           active = 1`,
      )
      .bind(source.id, source.name, source.baseUrl, source.collectionHandle)
      .run();
  }

  async beginRun(
    runId: string,
    source: SupplierSource,
    now: string,
  ): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO import_runs (id, supplier_id, started_at, status)
         VALUES (?, ?, ?, 'running')`,
      )
      .bind(runId, source.id, now)
      .run();
  }

  async upsertSupplierProduct(
    source: SupplierSource,
    product: SupplierProduct,
    now: string,
  ): Promise<"inserted" | "updated" | "unchanged"> {
    const promotedId = `catalog:${source.id}:${product.externalId}`;
    const promoted = await this.db
      .prepare("SELECT id FROM manual_products WHERE id = ?")
      .bind(promotedId)
      .first<{ id: string }>();
    if (promoted) return "unchanged";

    const existing = await this.db
      .prepare(
        `SELECT id, content_hash AS contentHash
         FROM supplier_products
         WHERE supplier_id = ? AND external_id = ?`,
      )
      .bind(source.id, product.externalId)
      .first<{ id: string; contentHash: string }>();

    const internalId = existing?.id ?? `${source.id}:${product.externalId}`;
    if (!existing) {
      await this.db
        .prepare(
          `INSERT INTO supplier_products (
             id, supplier_id, external_id, handle, title, description_html,
             source_url, source_price_pkr, compare_at_price_pkr, image_url,
             gallery_json, variants_json, source_available, source_updated_at,
             content_hash, first_seen_at, last_seen_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          internalId,
          source.id,
          product.externalId,
          product.handle,
          product.title,
          product.descriptionHtml,
          product.sourceUrl,
          product.sourcePricePkr,
          product.compareAtPricePkr,
          product.imageUrl,
          JSON.stringify(product.gallery),
          JSON.stringify(product.variants),
          product.available ? 1 : 0,
          product.sourceUpdatedAt,
          product.contentHash,
          now,
          now,
        )
        .run();
      await this.db
        .prepare(
          `INSERT INTO catalog_products (
             id, supplier_product_id, category, public_title, overhead_pkr,
             target_margin_bps, pricing_status, publish_status, supply_mode,
             stock_qty, created_at, updated_at
           ) VALUES (?, ?, 'pret', ?, 250, 2500, 'awaiting_cost', 'draft',
             'on_demand', 0, ?, ?)
           ON CONFLICT(supplier_product_id) DO NOTHING`,
        )
        .bind(promotedId, internalId, product.title, now, now)
        .run();
      return "inserted";
    }

    if (existing.contentHash === product.contentHash) {
      await this.db
        .prepare(
          `UPDATE supplier_products
           SET last_seen_at = ?, source_available = ?
           WHERE id = ?`,
        )
        .bind(now, product.available ? 1 : 0, internalId)
        .run();
      return "unchanged";
    }

    await this.db
      .prepare(
        `UPDATE supplier_products SET
           handle = ?, title = ?, description_html = ?, source_url = ?,
           source_price_pkr = ?, compare_at_price_pkr = ?, image_url = ?,
           gallery_json = ?, variants_json = ?, source_available = ?,
           source_updated_at = ?, content_hash = ?, last_seen_at = ?
         WHERE id = ?`,
      )
      .bind(
        product.handle,
        product.title,
        product.descriptionHtml,
        product.sourceUrl,
        product.sourcePricePkr,
        product.compareAtPricePkr,
        product.imageUrl,
        JSON.stringify(product.gallery),
        JSON.stringify(product.variants),
        product.available ? 1 : 0,
        product.sourceUpdatedAt,
        product.contentHash,
        now,
        internalId,
      )
      .run();
    return "updated";
  }

  async markMissingUnavailable(
    source: SupplierSource,
    seenAt: string,
  ): Promise<void> {
    await this.db
      .prepare(
        `UPDATE supplier_products
         SET source_available = 0
         WHERE supplier_id = ? AND last_seen_at < ?`,
      )
      .bind(source.id, seenAt)
      .run();
  }

  async finishRun(
    runId: string,
    status: "completed" | "failed",
    counts: SyncCounts,
    finishedAt: string,
    errorMessage?: string,
  ): Promise<void> {
    await this.db
      .prepare(
        `UPDATE import_runs SET
           finished_at = ?, status = ?, discovered_count = ?,
           inserted_count = ?, updated_count = ?, unchanged_count = ?,
           error_message = ?
         WHERE id = ?`,
      )
      .bind(
        finishedAt,
        status,
        counts.discovered,
        counts.inserted,
        counts.updated,
        counts.unchanged,
        errorMessage ?? null,
        runId,
      )
      .run();
    if (status === "completed") {
      await this.db
        .prepare(
          `UPDATE suppliers
           SET last_synced_at = ?
           WHERE id = (SELECT supplier_id FROM import_runs WHERE id = ?)`,
        )
        .bind(finishedAt, runId)
        .run();
    }
  }
}
