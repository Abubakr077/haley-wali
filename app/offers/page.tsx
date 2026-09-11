import type { Metadata } from "next";
import { AdminPageHeader } from "../AdminPageHeader";
import { OfferManager } from "../OfferManager";

export const metadata: Metadata = {
  title: "Offers",
  description: "Create and manage Haley Wali offer codes.",
};

export default function OffersPage() {
  return (
    <main className="admin-page">
      <AdminPageHeader
        eyebrow="SHOP SETTINGS · OFFERS"
        title="OFFERS"
        description="Create one code at a time for percent off, a fixed PKR amount, free delivery, or a mix of those."
      />
      <OfferManager />
    </main>
  );
}
