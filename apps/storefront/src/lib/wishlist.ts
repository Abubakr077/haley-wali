const WISHLIST_KEY = "haley-wali-wishlist";
export const WISHLIST_EVENT = "haley-wali-wishlist-updated";

export function readWishlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(WISHLIST_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function writeWishlist(ids: string[]) {
  localStorage.setItem(WISHLIST_KEY, JSON.stringify([...new Set(ids)]));
  window.dispatchEvent(new CustomEvent(WISHLIST_EVENT));
}

export function toggleWishlist(productId: string): boolean {
  const ids = readWishlist();
  const saved = ids.includes(productId);
  writeWishlist(saved ? ids.filter((id) => id !== productId) : [...ids, productId]);
  return !saved;
}
