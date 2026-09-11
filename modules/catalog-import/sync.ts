import { fetchShopifyCollection } from "./shopify.ts";
import type {
  CatalogRepository,
  SupplierSource,
  SyncCounts,
} from "./types.ts";

export const CHAUDHARY_ARTS_SOURCE: SupplierSource = {
  id: "chaudhary-arts",
  name: "Supplier A",
  baseUrl: "https://chaudharyarts.com",
  collectionHandle: "new-arrival",
};

export type RunSupplierSyncInput = {
  source?: SupplierSource;
  repository: CatalogRepository;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  runId?: string;
};

export async function runSupplierSync({
  source = CHAUDHARY_ARTS_SOURCE,
  repository,
  fetchImpl = fetch,
  now = () => new Date(),
  runId,
}: RunSupplierSyncInput): Promise<SyncCounts> {
  const startedAt = now().toISOString();
  const activeRunId =
    runId ?? `${source.id}:${startedAt.replaceAll(/[^0-9]/g, "").slice(0, 14)}`;
  const counts: SyncCounts = {
    discovered: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
  };

  await repository.ensureSupplier(source, startedAt);
  await repository.beginRun(activeRunId, source, startedAt);

  try {
    const products = await fetchShopifyCollection(source, fetchImpl);
    counts.discovered = products.length;
    for (const product of products) {
      const result = await repository.upsertSupplierProduct(
        source,
        product,
        startedAt,
      );
      counts[result] += 1;
    }
    await repository.markMissingUnavailable(source, startedAt);
    await repository.finishRun(
      activeRunId,
      "completed",
      counts,
      now().toISOString(),
    );
    return counts;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await repository.finishRun(
      activeRunId,
      "failed",
      counts,
      now().toISOString(),
      message,
    );
    throw error;
  }
}
