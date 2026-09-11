import type { Metadata } from "next";
import { AdminPageHeader } from "../../AdminPageHeader";
import { OfferManager } from "../../OfferManager";

export const metadata: Metadata = {
  title: "Add Offer",
  description: "Create a new Haley Wali offer code.",
};

export default function NewOfferPage() {
  return (
    <main className="admin-page">
      <AdminPageHeader
        eyebrow="SHOP SETTINGS · NEW OFFER"
        title="ADD OFFER"
        description="Set the code customers will enter at bag and checkout, then choose the discount and who it applies to."
      />
      <OfferManager creating />
    </main>
  );
}
