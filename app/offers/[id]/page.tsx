import type { Metadata } from "next";
import { AdminPageHeader } from "../../AdminPageHeader";
import { OfferManager } from "../../OfferManager";

export const metadata: Metadata = { title: "Offer Details" };

export default async function OfferDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="admin-page">
      <AdminPageHeader
        eyebrow="SHOP SETTINGS · OFFER DETAILS"
        title="OFFER"
        description="Edit this offer, turn it off without deleting it, or check how many times it has been used."
      />
      <OfferManager selectedId={id} />
    </main>
  );
}
