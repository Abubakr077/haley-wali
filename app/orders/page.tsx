import type { Metadata } from "next";
import { AdminPageHeader } from "../AdminPageHeader";
import { CatalogManager } from "../CatalogManager";

export const metadata: Metadata = {
  title: "Orders",
  description: "Manage Haley Wali Cash on Delivery orders.",
};

export default function OrdersPage() {
  return (
    <main className="admin-page">
      <AdminPageHeader
        eyebrow="CUSTOMERS · CASH ON DELIVERY"
        title="ORDERS"
        description="Review customer details and move every order from Received through packing, dispatch and delivery."
      />
      <CatalogManager lastImportedAt={null} view="orders" />
    </main>
  );
}
