import { useEffect, useState } from "react";
import { CART_EVENT, cartCount, readCart } from "../lib/cart";

export default function BagCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => setCount(cartCount(readCart()));
    update();
    window.addEventListener(CART_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(CART_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return (
    <span aria-label={`${count} ${count === 1 ? "article" : "articles"} in bag`}>
      {count}
    </span>
  );
}
