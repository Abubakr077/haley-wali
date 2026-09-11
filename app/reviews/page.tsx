import type { Metadata } from "next";
import { AdminPageHeader } from "../AdminPageHeader";
import { ReviewManager } from "../ReviewManager";

export const metadata: Metadata = { title: "Product Reviews", description: "Moderate Haley Wali product reviews." };

export default function ReviewsPage() {
  return <main className="admin-page"><AdminPageHeader eyebrow="CUSTOMER FEEDBACK" title="REVIEWS" description="Check customer feedback, approve suitable reviews and keep rejected reviews off the storefront." /><ReviewManager /></main>;
}
