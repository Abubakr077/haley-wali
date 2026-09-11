import type { Metadata } from "next";
import { AdminPageHeader } from "../../AdminPageHeader";
import { CatalogManager } from "../../CatalogManager";

export const metadata: Metadata = {
  title: "Order Details",
  description: "Review and fulfil one Haley Wali customer order.",
};

export default async function OrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="admin-page">
      <AdminPageHeader
        eyebrow="CUSTOMER ORDER · DETAILS"
        title="ORDER DETAILS"
        description="Review the customer, delivery address and ordered articles, then update this order's current stage."
      />
      <CatalogManager lastImportedAt={null} view="order-detail" selectedId={id} />
    </main>
  );
}
