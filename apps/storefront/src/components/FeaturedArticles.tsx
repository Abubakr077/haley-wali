import { useEffect, useState } from "react";
import { mapPublishedArticle } from "../lib/products";
import type { Product } from "../lib/types";
import { ProductCard } from "./CatalogExplorer";
import { ArticleGridLoading } from "./LoadingState";

export default function FeaturedArticles({
  apiBase,
  initialProducts = [],
}: {
  apiBase: string;
  initialProducts?: Product[];
}) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [loaded, setLoaded] = useState(initialProducts.length > 0);
  const [catalogUnavailable, setCatalogUnavailable] = useState(false);

  useEffect(() => {
    fetch(`${apiBase}/api/catalog/articles`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Catalog unavailable");
        const result = await response.json() as { products?: Parameters<typeof mapPublishedArticle>[0][] };
        const liveProducts = (result.products ?? [])
          .map(mapPublishedArticle)
          .filter((article) => article.category === "exclusive")
          .slice(0, 4);
        if (liveProducts.length || !initialProducts.length) setProducts(liveProducts);
        setCatalogUnavailable(false);
      })
      .catch(() => {
        // Keep the already-rendered articles visible if the browser refresh fails.
        setCatalogUnavailable(true);
      })
      .finally(() => setLoaded(true));
  }, [apiBase, initialProducts]);

  if (!loaded) return <ArticleGridLoading label="Loading latest HW Exclusive articles" />;
  if (catalogUnavailable && !products.length) return <div className="home-catalog-empty"><h3>Articles are still loading.</h3><p>Please refresh to try again.</p></div>;
  if (!products.length) return <div className="home-catalog-empty"><h3>HW Exclusive articles are coming soon.</h3><p>New articles will appear here as soon as they are published.</p></div>;
  return <div className="product-grid">{products.map((product) => <ProductCard product={product} key={product.id} />)}</div>;
}
