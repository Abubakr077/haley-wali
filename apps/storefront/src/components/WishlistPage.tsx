import { useEffect, useState } from "react";
import { mapPublishedArticle } from "../lib/products";
import { readWishlist, WISHLIST_EVENT } from "../lib/wishlist";
import type { Product } from "../lib/types";
import { ProductCard } from "./CatalogExplorer";
import { LoadingState } from "./LoadingState";

export default function WishlistPage({ apiBase }: { apiBase: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const update = () => setIds(readWishlist());
    update();
    window.addEventListener(WISHLIST_EVENT, update);
    return () => window.removeEventListener(WISHLIST_EVENT, update);
  }, []);

  useEffect(() => {
    fetch(`${apiBase}/api/catalog/articles`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Catalog unavailable");
        const result = await response.json() as { products?: Parameters<typeof mapPublishedArticle>[0][] };
        setProducts((result.products ?? []).map(mapPublishedArticle));
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [apiBase]);

  const saved = ids.map((id) => products.find((product) => product.id === id)).filter((product): product is Product => Boolean(product));
  if (loading) return <section className="page-shell narrow"><LoadingState label="Loading your wishlist" description="Checking your saved articles." /></section>;
  if (!ids.length) return <section className="page-shell narrow empty-state"><p className="eyebrow">YOUR WISHLIST</p><h1>NO SAVED ARTICLES YET.</h1><p>Use the heart button on any article to keep it here for later.</p><a className="primary-button" href="/shop">SHOP ARTICLES</a></section>;
  return <>{saved.length ? <div className="product-grid wishlist-grid">{saved.map((product) => <ProductCard product={product} key={product.id} />)}</div> : <section className="page-shell narrow empty-state"><h1>YOUR SAVED ARTICLES ARE NOT AVAILABLE.</h1><p>They may be sold out or no longer published.</p><a className="primary-button" href="/shop">VIEW AVAILABLE ARTICLES</a></section>}</>;
}
