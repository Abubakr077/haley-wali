"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type CustomerRequest = {
  id: string;
  number: string;
  type: string;
  orderNumber: string | null;
  name: string;
  phone: string;
  email: string | null;
  articleName: string | null;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
};

async function readJson<T>(response: Response): Promise<T> {
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error || "Request failed.");
  return result;
}

export function SupportManager({ selectedId }: { selectedId?: string }) {
  const router = useRouter();
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [selected, setSelected] = useState<CustomerRequest | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const url = selectedId ? `/api/admin/requests?id=${encodeURIComponent(selectedId)}` : "/api/admin/requests";
    fetch(url)
      .then((response) => readJson<{ requests?: CustomerRequest[]; request?: CustomerRequest }>(response))
      .then((result) => {
        if (result.request) setSelected(result.request);
        if (result.requests) setRequests(result.requests);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : String(error)))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return requests.filter((request) =>
      (status === "all" || request.status === status) &&
      (!search || [request.number, request.name, request.phone, request.orderNumber, request.type]
        .filter(Boolean).join(" ").toLowerCase().includes(search)),
    );
  }, [query, requests, status]);

  async function updateStatus(nextStatus: string) {
    if (!selected) return;
    setMessage("");
    try {
      const result = await readJson<{ requests: CustomerRequest[] }>(await fetch("/api/admin/requests", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: selected.id, status: nextStatus }),
      }));
      const updated = result.requests.find((request) => request.id === selected.id);
      if (updated) setSelected(updated);
      setMessage("Customer request updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function removeRequest() {
    if (!selected || !window.confirm(`Permanently delete customer request ${selected.number}? This cannot be undone.`)) return;
    setDeleting(true);
    setMessage("");
    try {
      await readJson<{ requests: CustomerRequest[] }>(await fetch(
        `/api/admin/requests?id=${encodeURIComponent(selected.id)}`,
        { method: "DELETE" },
      ));
      setSelected(null);
      router.push("/requests");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <p className="queue-loading">Loading customer requests…</p>;
  if (selectedId) {
    if (!selected) return <section className="manager-missing-record"><h2>Request not found</h2><p>{message}</p><Link href="/requests">BACK TO REQUESTS</Link></section>;
    return (
      <div className="manager-detail-screen">
        <Link className="manager-back-link" href="/requests">← BACK TO CUSTOMER REQUESTS</Link>
        <div className="order-detail-layout">
          <section className="order-detail-main">
            <div className="order-detail-title"><div><p className="eyebrow">{selected.type.toUpperCase()} REQUEST</p><h2>{selected.number}</h2></div><i className={`record-status ${selected.status}`}>{selected.status}</i></div>
            <div className="order-detail-block"><h3>CUSTOMER</h3><dl>
              <div><dt>Name</dt><dd>{selected.name}</dd></div><div><dt>Mobile</dt><dd>{selected.phone}</dd></div><div><dt>Email</dt><dd>{selected.email || "—"}</dd></div><div><dt>Order number</dt><dd>{selected.orderNumber || "—"}</dd></div><div><dt>Article</dt><dd>{selected.articleName || "—"}</dd></div>
            </dl></div>
            <div className="order-detail-block"><h3>REQUEST DETAILS</h3><dl><div><dt>Reason</dt><dd>{selected.reason}</dd></div><div><dt>Details</dt><dd>{selected.details}</dd></div></dl></div>
          </section>
          <aside className="order-detail-side"><h3>UPDATE REQUEST</h3><label>STATUS<select disabled={deleting} value={selected.status} onChange={(event) => updateStatus(event.target.value)}><option value="received">Received</option><option value="contacted">Customer contacted</option><option value="approved">Approved</option><option value="resolved">Resolved</option><option value="rejected">Rejected</option></select></label><button className="danger-action" disabled={deleting} type="button" onClick={removeRequest}>DELETE REQUEST PERMANENTLY</button><p className="editor-message" aria-live="polite">{message}</p></aside>
        </div>
      </div>
    );
  }

  return (
    <section className="manager-record-section">
      <div className="manager-list-toolbar"><div><p className="eyebrow">CUSTOMER CARE</p><h2>REQUESTS</h2><p>Exchange, return, complaint and article questions.</p></div></div>
      <div className="manager-list-filters"><label>SEARCH REQUESTS<input type="search" placeholder="Request, order, name or phone" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label>STATUS<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All requests</option><option value="received">Received</option><option value="contacted">Contacted</option><option value="approved">Approved</option><option value="resolved">Resolved</option><option value="rejected">Rejected</option></select></label></div>
      <div className="manager-record-list">
        <div className="manager-record-head" aria-hidden="true"><span>REQUEST</span><span>TYPE</span><span>ORDER</span><span>CUSTOMER</span><span>STATUS</span><span></span></div>
        {visible.map((request) => <Link className="manager-record-row" href={`/requests/${encodeURIComponent(request.id)}`} key={request.id}><span><strong>{request.number}</strong><small>{new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" }).format(new Date(request.createdAt))}</small></span><span><strong>{request.type}</strong><small>{request.reason}</small></span><span><strong>{request.orderNumber || "—"}</strong></span><span><strong>{request.name}</strong><small>{request.phone}</small></span><span><i className={`record-status ${request.status}`}>{request.status}</i></span><span className="record-open">OPEN <b aria-hidden="true">→</b></span></Link>)}
        {!visible.length ? <p className="manager-list-empty">No customer requests match these filters.</p> : null}
      </div>
      <p className="editor-message" aria-live="polite">{message}</p>
    </section>
  );
}
