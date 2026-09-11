import type { Metadata } from "next";
import { AdminPageHeader } from "../AdminPageHeader";
import { CatalogManager } from "../CatalogManager";

export const metadata: Metadata = {
  title: "Articles",
  description: "Add and manage Haley Wali Exclusive and Branded articles.",
};

export default function ArticlesPage() {
  return (
    <main className="admin-page">
      <AdminPageHeader
        eyebrow="CATALOG · MANUAL STOCK"
        title="ARTICLES"
        description="Add HW Exclusive articles or manually sourced Branded stock, then update price, details, stock and publication."
      />
      <CatalogManager lastImportedAt={null} view="articles" />
    </main>
  );
}

