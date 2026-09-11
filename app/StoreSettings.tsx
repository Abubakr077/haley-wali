"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

async function readJson<T>(response: Response): Promise<T> {
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(result.error || "Request failed.");
  return result;
}

export function StoreSettings() {
  const [deliveryPkr, setDeliveryPkr] = useState("250");
  const [saleActive, setSaleActive] = useState(true);
  const [salePercent, setSalePercent] = useState("10");
  const [saleName, setSaleName] = useState("Season End Sale");
  const [saleDescription, setSaleDescription] = useState("The reduced price is already shown across HW Exclusive and Branded articles. No sale code is needed.");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((response) => readJson<{
        deliveryPkr: number;
        saleActive: boolean;
        salePercent: number;
        saleName: string;
        saleDescription: string;
      }>(response))
      .then((result) => {
        setDeliveryPkr(String(result.deliveryPkr));
        setSaleActive(result.saleActive);
        setSalePercent(String(result.salePercent));
        setSaleName(result.saleName);
        setSaleDescription(result.saleDescription);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : String(error)))
      .finally(() => setLoading(false));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const result = await readJson<{
        deliveryPkr: number;
        saleActive: boolean;
        salePercent: number;
        saleName: string;
        saleDescription: string;
      }>(
        await fetch("/api/admin/settings", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            deliveryPkr: Number(deliveryPkr),
            saleActive,
            salePercent: Number(salePercent),
            saleName,
            saleDescription,
          }),
        }),
      );
      setDeliveryPkr(String(result.deliveryPkr));
      setSaleActive(result.saleActive);
      setSalePercent(String(result.salePercent));
      setSaleName(result.saleName);
      setSaleDescription(result.saleDescription);
      const deliveryMessage = result.deliveryPkr === 0
        ? "Nationwide delivery is free."
        : `Delivery is PKR ${result.deliveryPkr.toLocaleString("en-PK")}.`;
      const saleMessage = result.saleActive
        ? `${result.saleName} is active at ${result.salePercent}% off every article.`
        : `${result.saleName} is off.`;
      setMessage(`${deliveryMessage} ${saleMessage}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="store-settings-card">
      <div>
        <p className="eyebrow">SHOP SETTINGS</p>
        <h2>Delivery and automatic sale</h2>
        <p>
          The delivery amount is charged on new orders. The automatic sale changes
          displayed article prices and the server-enforced checkout price without a
          code. Turn it off or change its percentage here at any time.
        </p>
        <Link href="/offers">MANAGE OFFER CODES →</Link>
      </div>
      {loading ? <p className="queue-loading">Loading delivery charge…</p> : (
        <div>
          <form onSubmit={save}>
            <label>
              DELIVERY PKR
              <input
                inputMode="numeric"
                min="0"
                step="1"
                required
                value={deliveryPkr}
                onChange={(event) => setDeliveryPkr(event.target.value)}
              />
            </label>
            <label>
              SALE NAME
              <input
                minLength={3}
                maxLength={60}
                required
                value={saleName}
                onChange={(event) => setSaleName(event.target.value)}
              />
            </label>
            <label>
              SALE SLIDE DESCRIPTION
              <textarea
                maxLength={180}
                rows={4}
                value={saleDescription}
                onChange={(event) => setSaleDescription(event.target.value)}
                placeholder="Tell customers what is included and whether a code is needed."
              />
              <small>{saleDescription.length}/180 characters</small>
            </label>
            <label>
              FLAT SALE PERCENT
              <input
                inputMode="numeric"
                min="0"
                max="90"
                step="1"
                required
                value={salePercent}
                onChange={(event) => setSalePercent(event.target.value)}
              />
            </label>
            <label className="store-sale-toggle">
              <input
                type="checkbox"
                checked={saleActive}
                onChange={(event) => setSaleActive(event.target.checked)}
              />
              <span>SALE IS ACTIVE ON ALL ARTICLES</span>
            </label>
            <button className="primary-action" disabled={saving} type="submit">
              {saving ? "SAVING…" : "SAVE SHOP SETTINGS"}
            </button>
          </form>
          <p className="editor-message" aria-live="polite">{message}</p>
        </div>
      )}
    </section>
  );
}
