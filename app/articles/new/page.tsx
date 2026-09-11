import type { Metadata } from "next";
import { AdminPageHeader } from "../../AdminPageHeader";
import { CatalogManager } from "../../CatalogManager";

export const metadata: Metadata = {
  title: "Add Article",
  description: "Add a new Haley Wali Exclusive or Branded article.",
};

export default function NewArticlePage() {
  return (
    <main className="admin-page">
      <AdminPageHeader
        eyebrow="CATALOG · NEW STOCK"
        title="ADD ARTICLE"
        description="Create one HW Exclusive or manually sourced Branded article, set its stock and price, then publish it."
      />
      <CatalogManager lastImportedAt={null} view="article-new" />
    </main>
  );
}

