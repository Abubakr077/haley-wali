import { useEffect, useState } from "react";
import { formatPkr } from "../lib/products";
import { LoadingState } from "./LoadingState";

type Order = {
  number: string;
  name: string;
  city: string;
  phone: string;
  total: number;
  payment: string;
};

export default function OrderSuccess({ whatsappNumber }: { whatsappNumber: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setOrder(JSON.parse(localStorage.getItem("haley-wali-last-order") ?? "null"));
    } catch {
      setOrder(null);
    } finally {
      setReady(true);
    }
  }, []);

  if (!ready) return <LoadingState label="Loading order confirmation" description="Preparing your Cash on Delivery confirmation." />;

  const confirmationNumber = whatsappNumber.replace(/\D/g, "");
  const confirmationUrl = order && /^\d{10,15}$/.test(confirmationNumber)
    ? `https://wa.me/${confirmationNumber}?text=${encodeURIComponent(`Assalam-o-Alaikum, I confirm my Haley Wali Cash on Delivery order ${order.number}. Name: ${order.name}. Mobile: ${order.phone}. City: ${order.city}. Total: ${formatPkr(order.total)}.`)}`
    : "";

  return (
    <section className="success-panel">
      <span className="success-mark">✓</span>
      <p className="eyebrow">ORDER RECEIVED</p>
      <h1 className="display-title">
        THANK YOU{order?.name ? `, ${order.name}` : ""}.
      </h1>
      <p className="info-intro">
        {confirmationUrl
          ? "Your articles are reserved. Open WhatsApp below, then send the prepared message so we can confirm and prepare your order for dispatch."
          : "Your articles are reserved. Please keep your order number; the Haley Wali team will contact you to confirm delivery."}
      </p>
      {order ? (
        <dl>
          <div><dt>ORDER NUMBER</dt><dd>{order.number}</dd></div>
          <div><dt>DELIVERY CITY</dt><dd>{order.city}</dd></div>
          <div><dt>PAYMENT</dt><dd>{order.payment}</dd></div>
          <div><dt>TOTAL</dt><dd>{formatPkr(order.total)}</dd></div>
        </dl>
      ) : null}
      {confirmationUrl ? <a className="primary-button" href={confirmationUrl} target="_blank" rel="noreferrer">CONFIRM ORDER ON WHATSAPP</a> : null}
      <a className="primary-button" href="/">BACK TO HOME</a>
    </section>
  );
}
