import type { Metadata } from "next";
import { lastImportedAt } from "../../modules/catalog-import/sample-data.ts";
import { AdminPageHeader } from "../AdminPageHeader";
import { CatalogManager } from "../CatalogManager";

export const metadata: Metadata = {
  title: "Supplier Import",
  description: "Import, price and publish supplier Pret articles.",
};

export default function ImportsPage() {
  return (
    <main className="admin-page">
      <AdminPageHeader
        eyebrow="BRANDED · PRET"
        title="SUPPLIER IMPORT"
        description="Run the import when needed, review new Pret articles, set your buying and selling prices, then publish selected stock."
      />
      <CatalogManager lastImportedAt={lastImportedAt} view="import" />
    </main>
  );
}

