import type { Metadata } from "next";
import { AdminPageHeader } from "../../AdminPageHeader";
import { CatalogManager } from "../../CatalogManager";

export const metadata: Metadata = {
  title: "Imported Article Details",
  description: "Price and publish one imported Pret article.",
};

export default async function ImportedArticleDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="admin-page">
      <AdminPageHeader
        eyebrow="BRANDED · IMPORTED PRET"
        title="PRICE & PUBLISH"
        description="Review this imported article, enter your actual buying cost and selling price, then decide whether to publish it."
      />
      <CatalogManager lastImportedAt={null} view="import-detail" selectedId={id} />
    </main>
  );
}
