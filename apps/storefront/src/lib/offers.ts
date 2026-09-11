import type { CartItem } from "./types";

const OFFER_KEY = "haley-wali-offer-code";

export type OfferQuote = {
  code: string | null;
  discountPkr: number;
  deliveryPkr: number;
  subtotalPkr: number;
  totalPkr: number;
  label: string | null;
};

export type ShopSettings = {
  deliveryPkr: number;
  saleActive: boolean;
  salePercent: number;
  saleName: string;
  saleDescription: string;
};

export function readStoredOfferCode(): string {
  if (typeof window === "undefined") return "";
  try {
    return (sessionStorage.getItem(OFFER_KEY) ?? "").trim().toUpperCase();
  } catch {
    return "";
  }
}

export function storeOfferCode(code: string) {
  const value = code.trim().toUpperCase();
  if (value) sessionStorage.setItem(OFFER_KEY, value);
  else sessionStorage.removeItem(OFFER_KEY);
}

export function applyShopSale(pricePkr: number, settings: Pick<ShopSettings, "saleActive" | "salePercent">) {
  if (!settings.saleActive || settings.salePercent <= 0) return pricePkr;
  return Math.max(1, Math.floor((pricePkr * (100 - settings.salePercent)) / 100));
}

export function syncCartSalePrices(cart: CartItem[], settings: ShopSettings): CartItem[] {
  return cart.map((item) => {
    const originalPrice = item.product.originalPrice ?? item.product.price;
    const price = applyShopSale(originalPrice, settings);
    return {
      ...item,
      product: {
        ...item.product,
        price,
        originalPrice: price < originalPrice ? originalPrice : undefined,
        salePercent: price < originalPrice ? settings.salePercent : undefined,
        saleName: price < originalPrice ? settings.saleName : undefined,
      },
    };
  });
}

export async function loadShopSettings(apiBase: string): Promise<ShopSettings> {
  try {
    const response = await fetch(`${apiBase}/api/shop/settings`);
    const result = (await response.json()) as Partial<ShopSettings>;
    const deliveryPkr = Number(result.deliveryPkr);
    const salePercent = Number(result.salePercent);
    return {
      deliveryPkr: Number.isInteger(deliveryPkr) && deliveryPkr >= 0 ? deliveryPkr : 250,
      saleActive: result.saleActive !== false,
      salePercent: Number.isInteger(salePercent) && salePercent >= 0 && salePercent <= 90 ? salePercent : 10,
      saleName: String(result.saleName ?? "Season End Sale").trim() || "Season End Sale",
      saleDescription: String(result.saleDescription ?? "The reduced price is already shown across HW Exclusive and Branded articles. No sale code is needed.").trim(),
    };
  } catch {
    return {
      deliveryPkr: 250,
      saleActive: true,
      salePercent: 10,
      saleName: "Season End Sale",
      saleDescription: "The reduced price is already shown across HW Exclusive and Branded articles. No sale code is needed.",
    };
  }
}

export async function previewBag(
  apiBase: string,
  cart: CartItem[],
  code = "",
  phone = "",
): Promise<OfferQuote> {
  const response = await fetch(`${apiBase}/api/offers/preview`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      code: code.trim() || undefined,
      phone: phone || undefined,
      items: cart.map((item) => ({
        id: item.id,
        size: item.size,
        quantity: item.quantity,
      })),
    }),
  });
  const result = (await response.json()) as OfferQuote & { error?: string };
  if (!response.ok) throw new Error(result.error || "Could not check this code.");
  return result;
}
