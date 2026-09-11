import { useEffect, useState } from "react";
import {
  cartSubtotal,
  readCart,
  writeCart,
} from "../lib/cart";
import {
  loadShopSettings,
  previewBag,
  readStoredOfferCode,
  storeOfferCode,
  syncCartSalePrices,
  type OfferQuote,
} from "../lib/offers";
import { formatPkr } from "../lib/products";
import type { CartItem } from "../lib/types";
import { LoadingState } from "./LoadingState";
import { OfferSummary } from "./OfferSummary";

export default function BagPage({ apiBase }: { apiBase: string }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [codeDraft, setCodeDraft] = useState("");
  const [quote, setQuote] = useState<OfferQuote | null>(null);
  const [deliveryFallback, setDeliveryFallback] = useState(250);
  const [automaticSaleLabel, setAutomaticSaleLabel] = useState("");
  const [offerError, setOfferError] = useState("");
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const savedCart = readCart();
    setCodeDraft(readStoredOfferCode());
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

  function remove(index: number) {
    const next = cart.filter((_, itemIndex) => itemIndex !== index);
    setCart(next);
    writeCart(next);
  }

  function changeQuantity(index: number, nextQuantity: number) {
    const next = [...cart];
    const item = next[index];
    const available = item.product.stockBySize?.[item.size] ?? item.product.stockQty;
    item.quantity = Math.max(1, Math.min(nextQuantity, Math.max(1, available)));
    setCart(next);
    writeCart(next);
  }

  async function applyCode() {
    const code = codeDraft.trim().toUpperCase();
    setCodeDraft(code);
    setApplying(true);
    setOfferError("");
    try {
      const next = await previewBag(apiBase, cart, code);
      setQuote(next);
      storeOfferCode(next.code ?? code);
    } catch (error) {
      setOfferError(error instanceof Error ? error.message : String(error));
      const stored = readStoredOfferCode();
      const restore = stored && stored !== code ? stored : "";
      if (!restore) storeOfferCode("");
      const baseline = await previewBag(apiBase, cart, restore);
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

  const fallbackSubtotal = cartSubtotal(cart);
  const subtotal = quote?.subtotalPkr ?? fallbackSubtotal;
  const delivery = quote?.deliveryPkr ?? deliveryFallback;
  const discount = quote?.discountPkr ?? 0;
  const total = quote?.totalPkr ?? subtotal + delivery;

  if (!ready) return <LoadingState label="Loading your bag" description="Checking the articles saved in your bag." />;
  if (!cart.length) {
    return (
      <section className="empty-state">
        <p className="eyebrow">YOUR BAG</p>
        <h2>Your bag is empty.</h2>
        <a className="primary-button" href="/shop">SHOP ARTICLES</a>
      </section>
    );
  }

  return (
    <div className="bag-layout">
      <div className="bag-lines">
        {cart.map((item, index) => (
          <article className="bag-line" key={`${item.id}-${item.size}`}>
            <img src={item.product.image} alt={item.product.name} />
            <div>
              <h3>{item.product.name}</h3>
              <p>
                {item.product.title} · {item.size}
              </p>
              <div className="bag-actions"><div className="quantity-control" aria-label={`Quantity for ${item.product.name}`}><button type="button" aria-label="Decrease quantity" disabled={item.quantity <= 1} onClick={() => changeQuantity(index, item.quantity - 1)}>−</button><span>{item.quantity}</span><button type="button" aria-label="Increase quantity" disabled={item.quantity >= (item.product.stockBySize?.[item.size] ?? item.product.stockQty)} onClick={() => changeQuantity(index, item.quantity + 1)}>+</button></div><button type="button" onClick={() => remove(index)}>REMOVE</button></div>
            </div>
            <span className="bag-line-price">
              {item.product.originalPrice ? <del>{formatPkr(item.product.originalPrice * item.quantity)}</del> : null}
              <strong>{formatPkr(item.product.price * item.quantity)}</strong>
            </span>
          </article>
        ))}
      </div>
      <aside className="order-summary">
        <h2>Order Summary</h2>
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
        <a className="primary-button full-button" href="/checkout">CHECKOUT</a>
      </aside>
    </div>
  );
}
