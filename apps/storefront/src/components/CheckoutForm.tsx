import { useEffect, useState, type SubmitEvent } from "react";
import { cartSubtotal, readCart, writeCart } from "../lib/cart";
import {
  loadShopSettings,
  previewBag,
  readStoredOfferCode,
  storeOfferCode,
  syncCartSalePrices,
  type OfferQuote,
} from "../lib/offers";
import { pkrValue, trackMetaEvent } from "../lib/metaPixel";
import { formatPkr } from "../lib/products";
import type { CartItem } from "../lib/types";
import { LoadingState } from "./LoadingState";
import { OfferSummary } from "./OfferSummary";

export default function CheckoutForm({ apiBase }: { apiBase: string }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [checkoutToken, setCheckoutToken] = useState("");
  const [codeDraft, setCodeDraft] = useState("");
  const [quote, setQuote] = useState<OfferQuote | null>(null);
  const [deliveryFallback, setDeliveryFallback] = useState(250);
  const [automaticSaleLabel, setAutomaticSaleLabel] = useState("");
  const [offerError, setOfferError] = useState("");
  const [applying, setApplying] = useState(false);
  const [phone, setPhone] = useState("");
  const [checkoutTracked, setCheckoutTracked] = useState(false);

  useEffect(() => {
    const savedCart = readCart();
    setCodeDraft(readStoredOfferCode());
    setCheckoutToken(crypto.randomUUID());
    loadShopSettings(apiBase)
      .then((settings) => {
        const currentCart = syncCartSalePrices(savedCart, settings);
        setCart(currentCart);
        if (currentCart.length) writeCart(currentCart);
        setDeliveryFallback(settings.deliveryPkr);
        setAutomaticSaleLabel(settings.saleActive && settings.salePercent > 0
          ? `${settings.saleName} · Flat ${settings.salePercent}% off`
          : "");
      })
      .finally(() => setReady(true));
  }, [apiBase]);

  useEffect(() => {
    if (!ready || !cart.length) return;
    let cancelled = false;
    const stored = readStoredOfferCode();
    setApplying(true);
    previewBag(apiBase, cart, stored)
      .then((next) => {
        if (cancelled) return;
        setQuote(next);
        setOfferError("");
        if (stored && next.code) storeOfferCode(next.code);
      })
      .catch((error) => {
        if (cancelled) return;
        setOfferError(error instanceof Error ? error.message : String(error));
        storeOfferCode("");
        return previewBag(apiBase, cart, "").then((next) => {
          if (!cancelled) setQuote(next);
        });
      })
      .finally(() => {
        if (!cancelled) setApplying(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase, cart, ready]);

  useEffect(() => {
    if (!ready || checkoutTracked || !cart.length) return;
    const subtotal = cartSubtotal(cart);
    trackMetaEvent("InitiateCheckout", {
      content_ids: cart.map((item) => item.id),
      content_type: "product",
      num_items: cart.reduce((sum, item) => sum + item.quantity, 0),
      value: pkrValue((quote?.totalPkr ?? subtotal + deliveryFallback)),
      currency: "PKR",
    });
    setCheckoutTracked(true);
  }, [cart, checkoutTracked, deliveryFallback, quote?.totalPkr, ready]);

  async function applyCode() {
    const code = codeDraft.trim().toUpperCase();
    setCodeDraft(code);
    setApplying(true);
    setOfferError("");
    try {
      const next = await previewBag(apiBase, cart, code, phone);
      setQuote(next);
      storeOfferCode(next.code ?? code);
    } catch (error) {
      setOfferError(error instanceof Error ? error.message : String(error));
      const stored = readStoredOfferCode();
      const restore = stored && stored !== code ? stored : "";
      if (!restore) storeOfferCode("");
      const baseline = await previewBag(apiBase, cart, restore, phone);
      setQuote(baseline);
    } finally {
      setApplying(false);
    }
  }

  function removeCode() {
    storeOfferCode("");
    setCodeDraft("");
    setOfferError("");
    previewBag(apiBase, cart, "").then(setQuote).catch(() => setQuote(null));
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${apiBase}/api/orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          checkoutToken,
          name: data.get("name"),
          phone: data.get("phone"),
          address: data.get("address"),
          city: data.get("city"),
          postal: data.get("postal"),
          note: data.get("note"),
          offerCode: quote?.code || undefined,
          items: cart.map((item) => ({
            id: item.id,
            size: item.size,
            quantity: item.quantity,
          })),
        }),
      });
      const result = (await response.json()) as {
        order?: {
          number: string;
          name: string;
          city: string;
          phone: string;
          total: number;
          payment: string;
        };
        error?: string;
      };
      if (!response.ok || !result.order) {
        throw new Error(result.error || "Could not place the order.");
      }
      localStorage.setItem("haley-wali-last-order", JSON.stringify(result.order));
      storeOfferCode("");
      writeCart([]);
      window.location.href = "/success";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      setSubmitting(false);
    }
  }

  if (!ready) return <LoadingState label="Loading checkout" description="Preparing your order details." />;
  if (!cart.length) {
    return (
      <section className="empty-state">
        <h2>Your bag is empty.</h2>
        <a className="primary-button" href="/shop">BACK TO SHOP</a>
      </section>
    );
  }

  const fallbackSubtotal = cartSubtotal(cart);
  const subtotal = quote?.subtotalPkr ?? fallbackSubtotal;
  const delivery = quote?.deliveryPkr ?? deliveryFallback;
  const discount = quote?.discountPkr ?? 0;
  const total = quote?.totalPkr ?? subtotal + delivery;

  return (
    <div className="checkout-layout">
      <form className="line-form" onSubmit={submit} aria-busy={submitting}>
        <p className="eyebrow">DELIVERY DETAILS</p>
        <div className="field-grid">
          <label>
            FULL NAME
            <input name="name" autoComplete="name" required />
          </label>
          <label>
            MOBILE NUMBER
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="03XX XXXXXXX"
              pattern="03[0-9]{9}"
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value.replace(/\s+/g, ""))}
            />
          </label>
        </div>
        <label>
          COMPLETE ADDRESS
          <textarea name="address" autoComplete="street-address" required />
        </label>
        <div className="field-grid">
          <label>
            CITY
            <input name="city" autoComplete="address-level2" required />
          </label>
          <label>
            POSTAL CODE
            <input name="postal" inputMode="numeric" autoComplete="postal-code" />
          </label>
        </div>
        <label>
          ORDER NOTE (OPTIONAL)
          <textarea name="note" placeholder="Sizing or delivery instructions" />
        </label>
        <label className="confirmation-check"><input name="codConfirmation" type="checkbox" required /><span>I confirm that my mobile number and delivery address are correct and I will receive this Cash on Delivery parcel.</span></label>
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? "PLACING ORDER…" : "PLACE CASH ON DELIVERY ORDER"}
        </button>
        <p className="form-message" aria-live="polite">{message}</p>
      </form>
      <aside className="order-summary">
        <h2>Your Articles</h2>
        {cart.map((item) => (
          <div className="summary-line" key={`${item.id}-${item.size}`}>
            <span>{item.product.name} × {item.quantity}<br /><small>{item.size}</small></span>
            <span className="summary-line-price">
              {item.product.originalPrice ? <del>{formatPkr(item.product.originalPrice * item.quantity)}</del> : null}
              <strong>{formatPkr(item.product.price * item.quantity)}</strong>
            </span>
          </div>
        ))}
        <OfferSummary
          codeDraft={codeDraft}
          onCodeDraft={setCodeDraft}
          onApply={applyCode}
          onRemove={removeCode}
          applying={applying}
          error={offerError}
          quoteCode={quote?.code ?? ""}
          label={quote?.label}
          subtotal={subtotal}
          discount={discount}
          delivery={delivery}
          total={total}
          automaticSaleLabel={automaticSaleLabel}
        />
        <p>Payment: Cash on Delivery</p>
      </aside>
    </div>
  );
}
