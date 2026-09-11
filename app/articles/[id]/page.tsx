import type { Metadata } from "next";
import { AdminPageHeader } from "../../AdminPageHeader";
import { CatalogManager } from "../../CatalogManager";

export const metadata: Metadata = {
  title: "Article Details",
  description: "Edit one Haley Wali catalog article.",
};

export default async function ArticleDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="admin-page">
      <AdminPageHeader
        eyebrow="CATALOG · ARTICLE DETAILS"
        title="EDIT ARTICLE"
        description="Review and update this article only. Save changes, publish it, remove it from the shop or delete it."
      />
      <CatalogManager lastImportedAt={null} view="article-detail" selectedId={id} />
    </main>
  );
}

