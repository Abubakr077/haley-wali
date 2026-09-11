import type { Metadata } from "next";
import { AdminPageHeader } from "../../AdminPageHeader";
import { SupportManager } from "../../SupportManager";

export const metadata: Metadata = { title: "Customer Request Details" };

export default async function RequestDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="admin-page"><AdminPageHeader eyebrow="CUSTOMER CARE · REQUEST DETAILS" title="CUSTOMER REQUEST" description="Review the request, contact the customer and update its status." /><SupportManager selectedId={id} /></main>;
}
