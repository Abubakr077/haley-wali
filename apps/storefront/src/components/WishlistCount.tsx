import { useEffect, useState } from "react";
import { readWishlist, WISHLIST_EVENT } from "../lib/wishlist";

export default function WishlistCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(readWishlist().length);
    update();
    window.addEventListener(WISHLIST_EVENT, update);
    window.addEventListener("storage", update);
    return () => { window.removeEventListener(WISHLIST_EVENT, update); window.removeEventListener("storage", update); };
  }, []);
  return <>{count}</>;
}
