import type { Metadata } from "next";
import { AdminPageHeader } from "../AdminPageHeader";
import { SupportManager } from "../SupportManager";

export const metadata: Metadata = { title: "Customer Requests", description: "Manage Haley Wali customer care requests." };

export default function RequestsPage() {
  return <main className="admin-page"><AdminPageHeader eyebrow="CUSTOMER CARE" title="REQUESTS" description="Open exchange, return and complaint requests, contact the customer and record the result." /><SupportManager /></main>;
}
