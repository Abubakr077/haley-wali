"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Review = { id: string; productId: string; name: string; rating: number; title: string; comment: string; imageUrl?: string | null; status: string; createdAt: string };

async function readJson<T>(response: Response): Promise<T> {
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error || "Request failed.");
  return result;
}

export function ReviewManager({ selectedId }: { selectedId?: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selected, setSelected] = useState<Review | null>(null);
  const [status, setStatus] = useState("all");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(selectedId ? `/api/admin/reviews?id=${encodeURIComponent(selectedId)}` : "/api/admin/reviews")
      .then((response) => readJson<{ reviews?: Review[]; review?: Review }>(response))
      .then((result) => { if (result.review) setSelected(result.review); if (result.reviews) setReviews(result.reviews); })
      .catch((error) => setMessage(error instanceof Error ? error.message : String(error)))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const visible = useMemo(() => reviews.filter((review) => status === "all" || review.status === status), [reviews, status]);

  async function updateStatus(nextStatus: string) {
    if (!selected) return;
    setMessage("");
    try {
      const result = await readJson<{ reviews: Review[] }>(await fetch("/api/admin/reviews", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: selected.id, status: nextStatus }) }));
      setSelected(result.reviews.find((review) => review.id === selected.id) ?? { ...selected, status: nextStatus });
      setMessage(nextStatus === "approved" ? "Review approved and visible on the article." : "Review status updated.");
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  }

  async function remove() {
    if (!selected || !window.confirm("Permanently delete this review?")) return;
    try {
      await readJson(await fetch(`/api/admin/reviews?id=${encodeURIComponent(selected.id)}`, { method: "DELETE" }));
      window.location.href = "/reviews";
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  }

  if (loading) return <p className="queue-loading">Loading reviews…</p>;
  if (selectedId) {
    if (!selected) return <section className="manager-missing-record"><h2>Review not found</h2><p>{message}</p><Link href="/reviews">BACK TO REVIEWS</Link></section>;
    return <div className="manager-detail-screen"><Link className="manager-back-link" href="/reviews">← BACK TO REVIEWS</Link><div className="order-detail-layout"><section className="order-detail-main"><div className="order-detail-title"><div><p className="eyebrow">{selected.rating} / 5 STARS</p><h2>{selected.title || "CUSTOMER REVIEW"}</h2></div><i className={`record-status ${selected.status}`}>{selected.status}</i></div><div className="order-detail-block"><h3>REVIEW</h3><dl><div><dt>Customer</dt><dd>{selected.name}</dd></div><div><dt>Article ID</dt><dd>{selected.productId}</dd></div><div><dt>Submitted</dt><dd>{new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(selected.createdAt))}</dd></div><div><dt>Comment</dt><dd>{selected.comment}</dd></div></dl>{selected.imageUrl ? <div className="manager-review-image"><span>CUSTOMER PHOTO</span><img src={selected.imageUrl} alt="Customer photo attached to this review" /></div> : null}</div></section><aside className="order-detail-side"><h3>MODERATE REVIEW</h3><label>STATUS<select value={selected.status} onChange={(event) => updateStatus(event.target.value)}><option value="pending">Pending</option><option value="approved">Approved — public</option><option value="rejected">Rejected — hidden</option></select></label><button className="admin-danger-button" type="button" onClick={remove}>DELETE REVIEW</button><p className="editor-message" aria-live="polite">{message}</p></aside></div></div>;
  }

  return <section className="manager-record-section"><div className="manager-list-toolbar"><div><p className="eyebrow">CUSTOMER FEEDBACK</p><h2>REVIEWS</h2><p>Approve suitable reviews before they appear in the customer shop.</p></div></div><div className="manager-list-filters"><label>STATUS<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All reviews</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label></div><div className="manager-record-list"><div className="manager-record-head" aria-hidden="true"><span>REVIEW</span><span>RATING</span><span>ARTICLE</span><span>CUSTOMER</span><span>STATUS</span><span></span></div>{visible.map((review) => <Link className="manager-record-row" href={`/reviews/${encodeURIComponent(review.id)}`} key={review.id}><span><strong>{review.title || "Customer review"}</strong><small>{new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" }).format(new Date(review.createdAt))}</small></span><span><strong>{review.rating} / 5</strong></span><span><strong>{review.productId}</strong></span><span><strong>{review.name}</strong></span><span><i className={`record-status ${review.status}`}>{review.status}</i></span><span className="record-open">OPEN <b aria-hidden="true">→</b></span></Link>)}{!visible.length ? <p className="manager-list-empty">No reviews match this filter.</p> : null}</div><p className="editor-message" aria-live="polite">{message}</p></section>;
}
