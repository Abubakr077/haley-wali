import type { Metadata } from "next";
import { AdminPageHeader } from "../../AdminPageHeader";
import { ReviewManager } from "../../ReviewManager";

export const metadata: Metadata = { title: "Review Details" };

export default async function ReviewDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="admin-page"><AdminPageHeader eyebrow="CUSTOMER FEEDBACK · REVIEW DETAILS" title="CUSTOMER REVIEW" description="Approve, reject or delete this customer review." /><ReviewManager selectedId={id} /></main>;
}
