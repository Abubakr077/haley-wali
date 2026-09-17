import { useEffect, useMemo, useState } from "react";
import { formatPkr, mapPublishedArticle } from "../lib/products";
import type { Product, ProductCategory } from "../lib/types";
import WishlistButton from "./WishlistButton";
import { ArticleGridLoading, LoadingState } from "./LoadingState";

type Props = {
  initialProducts: Product[];
  apiBase: string;
  searchMode?: boolean;
  initialCategory?: "all" | ProductCategory;
  initialQuery?: string;
  initialBrand?: string;
  initialArticleType?: "all" | "pret" | "unstitched";
};

const categoryCopy = {
  all: {
    title: "Shop",
    lede: "Published clothing with Cash on Delivery across Pakistan.",
  },
  exclusive: {
    title: "HW Exclusive",
    lede: "Haley Wali's own customised articles.",
  },
  branded: {
    title: "Branded",
    lede: "Pret and unstitched articles from known brands.",
  },
} as const;

function customerBrandFilterName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  const normalizedName = name.toLocaleLowerCase("en");
  return normalizedName === "branded" || normalizedName === "other brands" ? "Other Brands" : name;
}

export function ProductCard({ product }: { product: Product }) {
  const soldOut = product.stockQty <= 0;
  return (
    <article className={`product-card${soldOut ? " is-sold-out" : ""}`}>
      <WishlistButton productId={product.id} compact />
      <a
        className="product-image"
        href={`/product?id=${encodeURIComponent(product.id)}`}
      >
        <img
          src={product.image}
          alt={`${product.name} ${product.title}`}
          loading="lazy"
        />
        <span className={soldOut ? "product-card-stock-status" : undefined}>{soldOut ? "Out of stock" : product.badge}</span>
      </a>
      <div className="product-copy">
        <div>
          <small>{product.brand}</small>
          <h3>{product.name} · {product.title}</h3>
          <span className="product-card-rating" aria-label={product.reviewCount ? `${product.reviewAverage} out of 5 from ${product.reviewCount} reviews` : "No reviews yet"}>
            <span aria-hidden="true">★</span> {product.reviewCount ? product.reviewAverage.toFixed(1) : "New"}
            <small>({product.reviewCount})</small>
          </span>
          <p>{product.pieces} · {product.type}</p>
        </div>
        <div>
          <span className="product-price-row">
            {product.originalPrice ? <del>{formatPkr(product.originalPrice)}</del> : null}
            <strong className={product.originalPrice ? "sale-price" : undefined}>{formatPkr(product.price)}</strong>
          </span>
          <a href={`/product?id=${encodeURIComponent(product.id)}`}>VIEW</a>
        </div>
      </div>
    </article>
  );
}

export default function CatalogExplorer({
  initialProducts,
  apiBase,
  searchMode = false,
  initialCategory = "all",
  initialQuery = "",
  initialBrand = "all",
  initialArticleType = "all",
}: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [category, setCategory] =
    useState<"all" | ProductCategory>(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const [brand, setBrand] = useState(initialBrand);
  const [articleType, setArticleType] = useState<"all" | "pret" | "unstitched">(initialArticleType);
  const [size, setSize] = useState("all");
  const [pieces, setPieces] = useState("all");
  const [fabric, setFabric] = useState("all");
  const [colour, setColour] = useState("all");
  const [minimumPrice, setMinimumPrice] = useState("");
  const [maximumPrice, setMaximumPrice] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState("new");
  const [syncState, setSyncState] = useState("Checking published articles…");
  const [loading, setLoading] = useState(true);
  const [catalogUnavailable, setCatalogUnavailable] = useState(false);

  useEffect(() => {
    fetch(`${apiBase}/api/catalog/articles`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Catalog API unavailable");
        const result = (await response.json()) as {
          products?: Parameters<typeof mapPublishedArticle>[0][];
        };
        const liveProducts = (result.products ?? []).map(mapPublishedArticle);
        // The server render is the dependable first result. Do not replace it
        // with an empty browser refresh when that request is interrupted.
        if (liveProducts.length || !initialProducts.length) setProducts(liveProducts);
        setCatalogUnavailable(false);
        setSyncState(
          liveProducts.length
            ? `${liveProducts.length} published article${liveProducts.length === 1 ? "" : "s"} available`
            : initialProducts.length
              ? `${initialProducts.length} published article${initialProducts.length === 1 ? "" : "s"} available`
              : "No articles are published yet",
        );
      })
      .catch(() => {
        // A connection failure is not proof that there are no articles. Keep
        // server-rendered products, or show a retry state when none are ready.
        setCatalogUnavailable(true);
        setSyncState("Published articles are temporarily unavailable");
      })
      .finally(() => setLoading(false));
  }, [apiBase, initialProducts]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const minimum = minimumPrice === "" ? null : Number(minimumPrice);
    const maximum = maximumPrice === "" ? null : Number(maximumPrice);
    const filtered = products.filter((product) => {
      const categoryMatch = category === "all" || product.category === category;
      const brandMatch = category !== "branded"
        || brand === "all"
        || customerBrandFilterName(product.brand).toLocaleLowerCase("en") === brand.toLocaleLowerCase("en");
      const typeMatch = articleType === "all"
        || (articleType === "pret" && product.type === "Ready to Wear")
        || (articleType === "unstitched" && product.type === "Unstitched");
      const sizeMatch = size === "all"
        || product.sizes?.some((availableSize) => availableSize.toLocaleLowerCase("en") === size.toLocaleLowerCase("en"));
      const piecesMatch = pieces === "all"
        || product.pieces.toLocaleLowerCase("en") === pieces.toLocaleLowerCase("en");
      const fabricMatch = fabric === "all"
        || product.fabric.toLocaleLowerCase("en") === fabric.toLocaleLowerCase("en");
      const colourMatch = colour === "all"
        || product.color.toLocaleLowerCase("en") === colour.toLocaleLowerCase("en");
      const priceMatch = (minimum === null || !Number.isFinite(minimum) || product.price >= minimum)
        && (maximum === null || !Number.isFinite(maximum) || product.price <= maximum);
      const queryMatch =
        !normalized ||
        [
          product.name,
          product.title,
          product.brand,
          product.type,
          product.fabric,
          product.color,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      return categoryMatch && brandMatch && typeMatch && sizeMatch && piecesMatch && fabricMatch && colourMatch && priceMatch && queryMatch;
    });

    if (sort === "low") filtered.sort((a, b) => a.price - b.price);
    if (sort === "high") filtered.sort((a, b) => b.price - a.price);
    return filtered;
  }, [articleType, brand, category, colour, fabric, maximumPrice, minimumPrice, pieces, products, query, size, sort]);
  const availableCategories = (["all", "exclusive", "branded"] as const).filter(
    (value) => value === "all" || products.some((product) => product.category === value),
  );
  const availableBrands = useMemo(() => {
    const names = new Map<string, string>();
    products
      .filter((product) => product.category === "branded")
      .forEach((product) => {
        const name = customerBrandFilterName(product.brand);
        const key = name.toLocaleLowerCase("en");
        if (name && !names.has(key)) names.set(key, name);
      });
    return [...names.values()].sort((a, b) => {
      if (a === "Other Brands") return 1;
      if (b === "Other Brands") return -1;
      return a.localeCompare(b, "en");
    });
  }, [products]);
  const filterProducts = useMemo(
    () => products.filter((product) => category === "all" || product.category === category),
    [category, products],
  );
  const availableSizes = useMemo(() => {
    const names = new Map<string, string>();
    filterProducts.forEach((product) => {
      (product.sizes ?? []).forEach((availableSize) => {
        const name = availableSize.trim().replace(/\s+/g, " ");
        const key = name.toLocaleLowerCase("en");
        if (name && !names.has(key)) names.set(key, name);
      });
    });
    const preferredOrder = ["xs", "s", "m", "l", "xl", "xxl"];
    return [...names.values()].sort((a, b) => {
      const aIndex = preferredOrder.indexOf(a.toLocaleLowerCase("en"));
      const bIndex = preferredOrder.indexOf(b.toLocaleLowerCase("en"));
      if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
      return a.localeCompare(b, "en", { numeric: true });
    });
  }, [filterProducts]);
  const availableFacets = useMemo(() => {
    function uniqueValues(values: string[], ignored: string[] = []) {
      const names = new Map<string, string>();
      values.forEach((value) => {
        const name = value.trim().replace(/\s+/g, " ");
        const key = name.toLocaleLowerCase("en");
        if (name && !ignored.includes(key) && !names.has(key)) names.set(key, name);
      });
      return [...names.values()].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
    }
    return {
      pieces: uniqueValues(filterProducts.map((product) => product.pieces), ["see article details"]),
      fabrics: uniqueValues(filterProducts.map((product) => product.fabric), ["see article details"]),
      colours: uniqueValues(filterProducts.map((product) => product.color), ["as shown"]),
    };
  }, [filterProducts]);
  const priceBounds = useMemo(() => {
    if (!filterProducts.length) return { minimum: 0, maximum: 0 };
    return {
      minimum: Math.min(...filterProducts.map((product) => product.price)),
      maximum: Math.max(...filterProducts.map((product) => product.price)),
    };
  }, [filterProducts]);
  const activeFilterCount = [
    category === "branded" && brand !== "all",
    articleType !== "all",
    size !== "all",
    pieces !== "all",
    fabric !== "all",
    colour !== "all",
    minimumPrice !== "",
    maximumPrice !== "",
  ].filter(Boolean).length;

  useEffect(() => {
    if (!filterOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setFilterOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [filterOpen]);

  function chooseCategory(next: "all" | ProductCategory) {
    setCategory(next);
    setBrand("all");
    setArticleType("all");
    setSize("all");
    setPieces("all");
    setFabric("all");
    setColour("all");
    setMinimumPrice("");
    setMaximumPrice("");
    const url = new URL(window.location.href);
    if (next === "all") url.searchParams.delete("category");
    else url.searchParams.set("category", next);
    url.searchParams.delete("brand");
    url.searchParams.delete("type");
    history.replaceState({}, "", url);
  }

  function chooseBrand(next: string) {
    setBrand(next);
    const url = new URL(window.location.href);
    if (next === "all") url.searchParams.delete("brand");
    else url.searchParams.set("brand", next);
    history.replaceState({}, "", url);
  }

  function chooseArticleType(next: "all" | "pret" | "unstitched") {
    setArticleType(next);
    const url = new URL(window.location.href);
    if (next === "all") url.searchParams.delete("type");
    else url.searchParams.set("type", next);
    history.replaceState({}, "", url);
  }

  function clearFilters() {
    chooseBrand("all");
    chooseArticleType("all");
    setSize("all");
    setPieces("all");
    setFabric("all");
    setColour("all");
    setMinimumPrice("");
    setMaximumPrice("");
  }

  return (
    <>
      {searchMode ? (
        <section className={`search-panel${query.trim() ? " search-panel-active" : ""}`}>
          <div className="search-panel-head">
            <strong>Search on haleywali.pk</strong>
            <a href="/" aria-label="Close search">CLOSE</a>
          </div>
          <form onSubmit={(event) => event.preventDefault()}>
            <input
              aria-label="Search articles"
              autoFocus
              placeholder="Search articles"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit" aria-label="Search">
              <span className="utility-icon utility-search-icon" aria-hidden="true"></span>
            </button>
          </form>
          {!query.trim() ? (
            <div className="search-suggestions">
              <div>
                <h2>POPULAR CATEGORIES</h2>
                <a href="/shop?category=exclusive">HW Exclusive</a>
                <a href="/shop?category=branded">Branded</a>
              </div>
              <div>
                <h2>TRENDING ARTICLES</h2>
                {loading ? <LoadingState compact label="Loading articles" /> : products.slice(0, 5).map((product) => (
                  <a
                    href={`/product?id=${encodeURIComponent(product.id)}`}
                    key={product.id}
                  >
                    {product.name} · {product.title}
                  </a>
                ))}
                {!loading && !products.length ? <span>New HW Exclusive articles will appear here after publication.</span> : null}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {!searchMode || query.trim() ? (
        <>
          <div className="catalog-tools">
            {searchMode ? (
              <div className="catalog-tabs" aria-label="Article categories">
                {availableCategories.map(
                  (value) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={category === value}
                      onClick={() => chooseCategory(value)}
                    >
                      {categoryCopy[value].title}
                    </button>
                  ),
                )}
              </div>
            ) : (
              <div className="catalog-copy">
                <h1 className="catalog-heading">{categoryCopy[category].title}</h1>
                <p className="catalog-lede">{categoryCopy[category].lede}</p>
              </div>
            )}
            <div className="catalog-actions">
              <div className="catalog-filter-control">
                <button
                  type="button"
                  className="catalog-filter-toggle"
                  aria-expanded={filterOpen}
                  aria-controls="catalog-filter-panel"
                  onClick={() => setFilterOpen((open) => !open)}
                >
                  FILTER{activeFilterCount ? ` (${activeFilterCount})` : ""}
                  <span aria-hidden="true">{filterOpen ? "−" : "+"}</span>
                </button>
                {filterOpen ? (
                  <>
                    <button
                      type="button"
                      className="catalog-filter-backdrop"
                      aria-label="Close filters"
                      onClick={() => setFilterOpen(false)}
                    />
                    <section className="catalog-filter-panel" id="catalog-filter-panel" aria-label="Article filters">
                      <header>
                        <div>
                          <strong>FILTER ARTICLES</strong>
                          <span>{visible.length} result{visible.length === 1 ? "" : "s"}</span>
                        </div>
                        <button type="button" aria-label="Close filters" onClick={() => setFilterOpen(false)}>×</button>
                      </header>
                      <div className="catalog-filter-groups">
                        {category === "branded" && availableBrands.length ? (
                          <fieldset>
                            <legend>BRAND</legend>
                            <div className="catalog-filter-options">
                              <button type="button" aria-pressed={brand === "all"} onClick={() => chooseBrand("all")}>ALL</button>
                              {availableBrands.map((availableBrand) => (
                                <button
                                  type="button"
                                  key={availableBrand}
                                  aria-pressed={availableBrand.toLocaleLowerCase("en") === brand.toLocaleLowerCase("en")}
                                  onClick={() => chooseBrand(availableBrand)}
                                >
                                  {availableBrand}
                                </button>
                              ))}
                            </div>
                          </fieldset>
                        ) : null}
                        <fieldset>
                          <legend>ARTICLE TYPE</legend>
                          <div className="catalog-filter-options">
                            <button type="button" aria-pressed={articleType === "all"} onClick={() => chooseArticleType("all")}>ALL</button>
                            <button type="button" aria-pressed={articleType === "pret"} onClick={() => chooseArticleType("pret")}>PRET / READY TO WEAR</button>
                            <button type="button" aria-pressed={articleType === "unstitched"} onClick={() => chooseArticleType("unstitched")}>UNSTITCHED</button>
                          </div>
                        </fieldset>
                        {availableSizes.length ? (
                          <fieldset>
                            <legend>SIZE</legend>
                            <div className="catalog-filter-options catalog-size-options">
                              <button type="button" aria-pressed={size === "all"} onClick={() => setSize("all")}>ALL</button>
                              {availableSizes.map((availableSize) => (
                                <button
                                  type="button"
                                  key={availableSize}
                                  aria-pressed={availableSize.toLocaleLowerCase("en") === size.toLocaleLowerCase("en")}
                                  onClick={() => setSize(availableSize)}
                                >
                                  {availableSize}
                                </button>
                              ))}
                            </div>
                          </fieldset>
                        ) : null}
                        {availableFacets.pieces.length ? (
                          <fieldset>
                            <legend>SUIT PIECES</legend>
                            <div className="catalog-filter-options">
                              <button type="button" aria-pressed={pieces === "all"} onClick={() => setPieces("all")}>ALL</button>
                              {availableFacets.pieces.map((availablePieces) => (
                                <button type="button" key={availablePieces} aria-pressed={availablePieces.toLocaleLowerCase("en") === pieces.toLocaleLowerCase("en")} onClick={() => setPieces(availablePieces)}>
                                  {availablePieces}
                                </button>
                              ))}
                            </div>
                          </fieldset>
                        ) : null}
                        {availableFacets.fabrics.length ? (
                          <fieldset>
                            <legend>FABRIC</legend>
                            <div className="catalog-filter-options">
                              <button type="button" aria-pressed={fabric === "all"} onClick={() => setFabric("all")}>ALL</button>
                              {availableFacets.fabrics.map((availableFabric) => (
                                <button type="button" key={availableFabric} aria-pressed={availableFabric.toLocaleLowerCase("en") === fabric.toLocaleLowerCase("en")} onClick={() => setFabric(availableFabric)}>
                                  {availableFabric}
                                </button>
                              ))}
                            </div>
                          </fieldset>
                        ) : null}
                        {availableFacets.colours.length ? (
                          <fieldset>
                            <legend>COLOUR</legend>
                            <div className="catalog-filter-options">
                              <button type="button" aria-pressed={colour === "all"} onClick={() => setColour("all")}>ALL</button>
                              {availableFacets.colours.map((availableColour) => (
                                <button type="button" key={availableColour} aria-pressed={availableColour.toLocaleLowerCase("en") === colour.toLocaleLowerCase("en")} onClick={() => setColour(availableColour)}>
                                  {availableColour}
                                </button>
                              ))}
                            </div>
                          </fieldset>
                        ) : null}
                        <fieldset>
                          <legend>PRICE</legend>
                          <div className="catalog-price-filter">
                            <label>
                              MINIMUM PKR
                              <input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                step="100"
                                placeholder={priceBounds.minimum ? String(priceBounds.minimum) : "0"}
                                value={minimumPrice}
                                onChange={(event) => setMinimumPrice(event.target.value)}
                              />
                            </label>
                            <span aria-hidden="true">—</span>
                            <label>
                              MAXIMUM PKR
                              <input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                step="100"
                                placeholder={priceBounds.maximum ? String(priceBounds.maximum) : "Any"}
                                value={maximumPrice}
                                onChange={(event) => setMaximumPrice(event.target.value)}
                              />
                            </label>
                          </div>
                        </fieldset>
                      </div>
                      <footer>
                        <button type="button" className="catalog-filter-clear" disabled={!activeFilterCount} onClick={clearFilters}>CLEAR FILTERS</button>
                        <button type="button" className="catalog-filter-apply" onClick={() => setFilterOpen(false)}>VIEW {visible.length} ARTICLE{visible.length === 1 ? "" : "S"}</button>
                      </footer>
                    </section>
                  </>
                ) : null}
              </div>
              <label className="catalog-sort">
                <span>SORT BY</span>
                <select
                  aria-label="Sort articles"
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="new">NEWEST</option>
                  <option value="low">PRICE: LOW TO HIGH</option>
                  <option value="high">PRICE: HIGH TO LOW</option>
                </select>
              </label>
            </div>
          </div>
          {searchMode ? (
            <div className="catalog-status" aria-live="polite">
              {loading ? "LOADING PUBLISHED ARTICLES…" : `${visible.length} ARTICLES · ${syncState.toUpperCase()}`}
            </div>
          ) : (
            <p className="catalog-status" aria-live="polite">
              {loading ? "Loading published articles…" : `${visible.length} article${visible.length === 1 ? "" : "s"}`}
            </p>
          )}
          {loading ? <ArticleGridLoading label="Loading published articles" /> : catalogUnavailable && !visible.length ? (
            <section className="page-shell empty-state">
              <h2>Articles are still loading</h2>
              <p>Please check your connection and try again.</p>
              <button type="button" className="primary-button" onClick={() => window.location.reload()}>
                TRY AGAIN
              </button>
            </section>
          ) : visible.length ? (
            <div className="product-grid">
              {visible.map((product) => (
                <ProductCard product={product} key={product.id} />
              ))}
            </div>
          ) : (
            <section className="page-shell empty-state">
              <h2>No articles found</h2>
              <p>Try a brand, colour, fabric, “unstitched” or “Pret”.</p>
            </section>
          )}
        </>
      ) : null}
    </>
  );
}
