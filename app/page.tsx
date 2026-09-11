import type { Metadata } from "next";
import { lastImportedAt } from "../modules/catalog-import/sample-data.ts";
import { AdminPageHeader } from "./AdminPageHeader";
import { CatalogManager } from "./CatalogManager";
import { StoreSettings } from "./StoreSettings";

export const metadata: Metadata = {
  title: { absolute: "Store Manager — Haley Wali" },
  description: "Manage Haley Wali articles, supplier imports and customer orders.",
};

export default function Home() {
  return (
    <main className="admin-page">
      <AdminPageHeader
        eyebrow="HALEY WALI · STORE MANAGER"
        title="STORE OVERVIEW"
        description="See what needs attention, then open the correct page to manage stock, supplier articles or Cash on Delivery orders."
      />

      <CatalogManager lastImportedAt={lastImportedAt} view="overview" />
      <StoreSettings />

      <section className="publish-flow">
        <p className="eyebrow">STORE WORKFLOW</p>
        <ol>
          <li><span>01</span><strong>ADD OR IMPORT</strong><p>Add your own article or fetch new supplier Pret stock.</p></li>
          <li><span>02</span><strong>PRICE</strong><p>Enter buying cost, selling price and available stock.</p></li>
          <li><span>03</span><strong>PUBLISH</strong><p>Choose HW Exclusive or Branded and show it in the customer shop.</p></li>
          <li><span>04</span><strong>FULFIL ORDER</strong><p>Confirm, pack, dispatch and complete the customer order.</p></li>
        </ol>
      </section>
    </main>
  );
}
