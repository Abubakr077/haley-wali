import { useEffect, useState } from "react";
import { trackMetaEvent } from "../lib/metaPixel";
import { readWishlist, toggleWishlist, WISHLIST_EVENT } from "../lib/wishlist";

export default function WishlistButton({ productId, compact = false }: { productId: string; compact?: boolean }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const update = () => setSaved(readWishlist().includes(productId));
    update();
    window.addEventListener(WISHLIST_EVENT, update);
    window.addEventListener("storage", update);
    return () => { window.removeEventListener(WISHLIST_EVENT, update); window.removeEventListener("storage", update); };
  }, [productId]);

  return (
    <button
      className={`wishlist-button${compact ? " compact" : ""}${saved ? " saved" : ""}`}
      type="button"
      onClick={() => {
        const nextSaved = toggleWishlist(productId);
        setSaved(nextSaved);
        if (nextSaved) {
          trackMetaEvent("AddToWishlist", {
            content_ids: [productId],
            content_type: "product",
          });
        }
      }}
      aria-pressed={saved}
      aria-label={saved ? "Remove article from wishlist" : "Save article to wishlist"}
    >
      <span aria-hidden="true">{saved ? "♥" : "♡"}</span>
      {compact ? null : saved ? "SAVED TO WISHLIST" : "SAVE TO WISHLIST"}
    </button>
  );
}
