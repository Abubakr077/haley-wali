"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";

type Offer = {
  id: string;
  code: string;
  name: string;
  status: string;
  discountType: string;
  discountValue: number;
  freeDelivery: boolean;
  appliesTo: string;
  minSubtotalPkr: number | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  perPhone: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

async function readJson<T>(response: Response): Promise<T> {
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(result.error || "Request failed.");
  return result;
}

function formatPkr(value: number) {
  return `PKR ${value.toLocaleString("en-PK")}`;
}

function dateInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" }).format(new Date(value));
}

function offerTypeLabel(offer: Offer) {
  const parts: string[] = [];
  if (offer.discountValue > 0) {
    parts.push(offer.discountType === "percent" ? `${offer.discountValue}% off` : `${formatPkr(offer.discountValue)} off`);
  }
  if (offer.freeDelivery) parts.push("Free delivery");
  return parts.join(" · ") || "—";
}

function appliesLabel(value: string) {
  if (value === "exclusive") return "HW Exclusive";
  if (value === "branded") return "Branded";
  return "All articles";
}

function OfferFields({ offer }: { offer?: Offer }) {
  return (
    <>
      <div className="manual-fields">
        <label>
          OFFER CODE
          <input name="code" defaultValue={offer?.code ?? ""} required maxLength={24} placeholder="SUMMER20" />
        </label>
        <label>
          INTERNAL NAME
          <input name="name" defaultValue={offer?.name ?? ""} required maxLength={80} placeholder="Summer 20 percent" />
        </label>
        <label>
          STATUS
          <select name="status" defaultValue={offer?.status ?? "active"}>
            <option value="active">Active</option>
            <option value="off">Off</option>
          </select>
        </label>
        <label>
          APPLIES TO
          <select name="appliesTo" defaultValue={offer?.appliesTo ?? "all"}>
            <option value="all">All articles</option>
            <option value="exclusive">HW Exclusive only</option>
            <option value="branded">Branded only</option>
          </select>
        </label>
        <label>
          DISCOUNT TYPE
          <select name="discountType" defaultValue={offer?.discountType ?? "percent"}>
            <option value="percent">Percent off articles</option>
            <option value="fixed">Fixed PKR off articles</option>
          </select>
        </label>
        <label>
          DISCOUNT VALUE
          <input name="discountValue" inputMode="numeric" min="0" step="1" defaultValue={String(offer?.discountValue ?? 0)} required />
        </label>
        <label className="wide-field confirmation-check">
          <input name="freeDelivery" type="checkbox" defaultChecked={offer?.freeDelivery ?? false} />
          <span>Also make nationwide delivery free for this order</span>
        </label>
        <label>
          MINIMUM SUBTOTAL PKR (OPTIONAL)
          <input name="minSubtotalPkr" inputMode="numeric" min="0" step="1" defaultValue={offer?.minSubtotalPkr?.toString() ?? ""} />
        </label>
        <label>
          MAXIMUM USES (OPTIONAL)
          <input name="maxRedemptions" inputMode="numeric" min="1" step="1" defaultValue={offer?.maxRedemptions?.toString() ?? ""} />
        </label>
        <label className="wide-field confirmation-check">
          <input name="perPhone" type="checkbox" defaultChecked={offer?.perPhone ?? false} />
          <span>One use per mobile number</span>
        </label>
        <label>
          START DATE (OPTIONAL)
          <input name="startsAt" type="date" defaultValue={dateInput(offer?.startsAt ?? null)} />
        </label>
        <label>
          END DATE (OPTIONAL)
          <input name="endsAt" type="date" defaultValue={dateInput(offer?.endsAt ?? null)} />
        </label>
      </div>
    </>
  );
}

function formOffer(form: HTMLFormElement, id?: string) {
  const data = new FormData(form);
  return {
    id,
    code: String(data.get("code") ?? ""),
    name: String(data.get("name") ?? ""),
    status: String(data.get("status") ?? "active"),
    discountType: String(data.get("discountType") ?? "percent"),
    discountValue: Number(data.get("discountValue") ?? 0),
    freeDelivery: data.get("freeDelivery") === "on",
    appliesTo: String(data.get("appliesTo") ?? "all"),
    minSubtotalPkr: String(data.get("minSubtotalPkr") ?? "").trim() || null,
    maxRedemptions: String(data.get("maxRedemptions") ?? "").trim() || null,
    perPhone: data.get("perPhone") === "on",
    startsAt: String(data.get("startsAt") ?? "").trim() || null,
    endsAt: String(data.get("endsAt") ?? "").trim() || null,
  };
}

export function OfferManager({ selectedId, creating = false }: { selectedId?: string; creating?: boolean }) {
  const router = useRouter();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selected, setSelected] = useState<Offer | null>(null);
  const [status, setStatus] = useState("all");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(!creating);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (creating) return;
    fetch(selectedId ? `/api/admin/offers?id=${encodeURIComponent(selectedId)}` : "/api/admin/offers")
      .then((response) => readJson<{ offers?: Offer[]; offer?: Offer }>(response))
      .then((result) => {
        if (result.offer) setSelected(result.offer);
        if (result.offers) setOffers(result.offers);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : String(error)))
      .finally(() => setLoading(false));
  }, [creating, selectedId]);

  const visible = useMemo(
    () => offers.filter((offer) => status === "all" || offer.status === status),
    [offers, status],
  );

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const result = await readJson<{ offer: Offer }>(
        await fetch("/api/admin/offers", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(formOffer(event.currentTarget)),
        }),
      );
      router.push(`/offers/${encodeURIComponent(result.offer.id)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      setSaving(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setMessage("");
    try {
      const result = await readJson<{ offer: Offer }>(
        await fetch("/api/admin/offers", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(formOffer(event.currentTarget, selected.id)),
        }),
      );
      setSelected(result.offer);
      setMessage("Offer saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  async function setOfferStatus(nextStatus: string) {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    try {
      const result = await readJson<{ offer: Offer }>(
        await fetch("/api/admin/offers", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: selected.id, status: nextStatus }),
        }),
      );
      setSelected(result.offer);
      setMessage(nextStatus === "off" ? "Offer turned off. Existing orders are unchanged." : "Offer is active.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  if (creating) {
    return (
      <section className="manager-detail-screen">
        <Link className="manager-back-link" href="/offers">← BACK TO OFFERS</Link>
        <form className="manual-product-form" onSubmit={create}>
          <div className="manager-section-head">
            <div><p className="eyebrow">NEW OFFER</p><h2>OFFER DETAILS</h2></div>
            <p>Create one code. Customers can use it on a bag. Codes are not stacked.</p>
          </div>
          <OfferFields />
          <div className="editor-actions">
            <button className="primary-action" disabled={saving} type="submit">{saving ? "SAVING…" : "CREATE OFFER"}</button>
          </div>
          <p className="editor-message" aria-live="polite">{message}</p>
        </form>
      </section>
    );
  }

  if (loading) return <p className="queue-loading">Loading offers…</p>;

  if (selectedId) {
    if (!selected) {
      return (
        <section className="manager-missing-record">
          <h2>Offer not found</h2>
          <p>{message}</p>
          <Link href="/offers">BACK TO OFFERS</Link>
        </section>
      );
    }
    return (
      <div className="manager-detail-screen">
        <Link className="manager-back-link" href="/offers">← BACK TO OFFERS</Link>
        <div className="order-detail-layout">
          <form className="manual-product-form existing-product" onSubmit={save}>
            <div className="manager-section-head">
              <div><p className="eyebrow">OFFER CODE</p><h2>{selected.code}</h2></div>
              <p>Customers see the code. They do not see this internal name.</p>
            </div>
            <OfferFields offer={selected} />
            <div className="editor-actions">
              <button className="primary-action" disabled={saving} type="submit">{saving ? "SAVING…" : "SAVE OFFER"}</button>
            </div>
            <p className="editor-message" aria-live="polite">{message}</p>
          </form>
          <aside className="order-detail-side">
            <h3>OFFER STATUS</h3>
            <i className={`record-status ${selected.status}`}>{selected.status}</i>
            <dl>
              <div><dt>Type</dt><dd>{offerTypeLabel(selected)}</dd></div>
              <div><dt>Applies to</dt><dd>{appliesLabel(selected.appliesTo)}</dd></div>
              <div><dt>Uses</dt><dd>{selected.redemptionCount}{selected.maxRedemptions != null ? ` / ${selected.maxRedemptions}` : ""}</dd></div>
              <div><dt>Per mobile</dt><dd>{selected.perPhone ? "One use" : "Not limited"}</dd></div>
              <div><dt>Starts</dt><dd>{formatDate(selected.startsAt)}</dd></div>
              <div><dt>Ends</dt><dd>{formatDate(selected.endsAt)}</dd></div>
            </dl>
            {selected.status === "active" ? (
              <button className="danger-action" disabled={saving} type="button" onClick={() => setOfferStatus("off")}>
                TURN OFFER OFF
              </button>
            ) : (
              <button className="primary-action" disabled={saving} type="button" onClick={() => setOfferStatus("active")}>
                TURN OFFER ON
              </button>
            )}
          </aside>
        </div>
      </div>
    );
  }

  return (
    <section className="manager-record-section">
      <div className="manager-list-toolbar">
        <div>
          <p className="eyebrow">SHOP OFFERS</p>
          <h2>OFFERS</h2>
          <p>Create a code for percent off, a fixed PKR amount, free delivery, or a mix of those.</p>
        </div>
        <Link className="manager-primary-link" href="/offers/new">ADD OFFER</Link>
      </div>
      <div className="manager-list-filters">
        <label>
          STATUS
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All offers</option>
            <option value="active">Active</option>
            <option value="off">Off</option>
          </select>
        </label>
      </div>
      <div className="manager-record-list">
        <div className="manager-record-head" aria-hidden="true">
          <span>CODE</span>
          <span>TYPE</span>
          <span>STATUS</span>
          <span>USES</span>
          <span>DATES</span>
          <span></span>
        </div>
        {visible.map((offer) => (
          <Link className="manager-record-row" href={`/offers/${encodeURIComponent(offer.id)}`} key={offer.id}>
            <span><strong>{offer.code}</strong><small>{offer.name}</small></span>
            <span><strong>{offerTypeLabel(offer)}</strong></span>
            <span><i className={`record-status ${offer.status}`}>{offer.status}</i></span>
            <span><strong>{offer.redemptionCount}{offer.maxRedemptions != null ? ` / ${offer.maxRedemptions}` : ""}</strong></span>
            <span><strong>{formatDate(offer.startsAt)} – {formatDate(offer.endsAt)}</strong></span>
            <span className="record-open">OPEN <b aria-hidden="true">→</b></span>
          </Link>
        ))}
        {!visible.length ? <p className="manager-list-empty">No offers match this filter.</p> : null}
      </div>
      <p className="editor-message" aria-live="polite">{message}</p>
    </section>
  );
}
