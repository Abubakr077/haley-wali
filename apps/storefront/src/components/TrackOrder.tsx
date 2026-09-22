import { useState, type SubmitEvent } from "react";
import { LoadingState } from "./LoadingState";

type TrackedOrder = {
  number: string;
  city: string;
  total: number;
  status: string;
  postexTrackingNumber?: string | null;
};

const statusCopy: Record<string, string> = {
  received: "Your order has been received.",
  confirmed: "Your article and delivery details are confirmed.",
  packed: "Your order is packed and ready for the courier.",
  dispatched: "Your order has been dispatched.",
  delivered: "Your order has been delivered.",
  cancelled: "This order was cancelled.",
};

export default function TrackOrder({ apiBase }: { apiBase: string }) {
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const number = String(data.get("order") ?? "").toUpperCase();
    const phone = String(data.get("phone") ?? "");
    setMessage("");
    setOrder(null);
    setCopied(false);
    setChecking(true);
    try {
      const response = await fetch(
        `${apiBase}/api/orders/track?number=${encodeURIComponent(number)}&phone=${encodeURIComponent(phone)}`,
      );
      const result = (await response.json()) as {
        order?: TrackedOrder;
        error?: string;
      };
      if (!response.ok || !result.order) {
        throw new Error(result.error || "Order was not found.");
      }
      setOrder(result.order);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      <form className="line-form" onSubmit={submit} aria-busy={checking}>
        <label>
          ORDER NUMBER
          <input name="order" placeholder="HW-1234567" required />
        </label>
        <label>
          MOBILE NUMBER USED FOR THE ORDER
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder="03XX XXXXXXX"
            pattern="03[0-9]{9}"
            required
          />
        </label>
        <button className="primary-button" type="submit" disabled={checking}>{checking ? "CHECKING ORDER…" : "CHECK ORDER"}</button>
      </form>
      {checking ? <LoadingState compact label="Checking your order" description="Looking up the latest delivery stage." /> : null}
      <p className="form-message" aria-live="polite">{message}</p>
      {order ? (
        <section className="info-sections" aria-live="polite">
          <article>
            <h2>{order.number}</h2>
            <p>{statusCopy[order.status] || "Your order is being processed."}</p>
          </article>
          <article><h2>DELIVERY CITY</h2><p>{order.city}</p></article>
          {!((order.status === "dispatched" || order.status === "delivered") && order.postexTrackingNumber) ? (
            <article><h2>ORDER STAGE</h2><p>{order.status.toUpperCase()}</p></article>
          ) : null}
          {(order.status === "dispatched" || order.status === "delivered") && order.postexTrackingNumber ? (
            <article>
              <h2>POSTEX PARCEL TRACKING</h2>
              <div className="postex-tracking">
                <p>Tracking number: <strong>{order.postexTrackingNumber}</strong></p>
                <div className="postex-tracking-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(order.postexTrackingNumber!);
                        setCopied(true);
                      } catch {
                        setMessage("Select and copy the tracking number above.");
                      }
                    }}
                  >{copied ? "NUMBER COPIED" : "COPY NUMBER"}</button>
                  <a className="primary-button" href="https://postex.pk/tracking" target="_blank" rel="noopener noreferrer">TRACK ON POSTEX ↗</a>
                </div>
                <p>Enter the tracking number on PostEx to see the latest courier updates.</p>
              </div>
            </article>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
