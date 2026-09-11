import type { CartItem, Product } from "./types";

const CART_KEY = "haley-wali-cart";
export const CART_EVENT = "haley-wali-cart-updated";

export function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(CART_KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function writeCart(cart: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart.filter((item) => item.quantity > 0)));
  window.dispatchEvent(new CustomEvent(CART_EVENT));
}

export function addToCart(product: Product, size: string) {
  const cart = readCart();
  const existing = cart.find(
    (item) => item.id === product.id && item.size === size,
  );
  const available = product.stockBySize?.[size] ?? product.stockQty;
  if (existing) existing.quantity = Math.min(existing.quantity + 1, Math.max(1, available));
  else cart.push({ id: product.id, size, quantity: 1, product });
  writeCart(cart);
}

export function cartCount(cart = readCart()) {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

export function cartSubtotal(cart = readCart()) {
  return cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );
}
