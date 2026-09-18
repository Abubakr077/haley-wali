import { useEffect, useState } from "react";
import { addToCart } from "../lib/cart";
import { formatPkr, mapPublishedArticle } from "../lib/products";
import type { Product } from "../lib/types";
import { pkrValue, trackMetaEvent } from "../lib/metaPixel";
import ProductReviews from "./ProductReviews";
import { ProductCard } from "./CatalogExplorer";
import WishlistButton from "./WishlistButton";
import { LoadingState } from "./LoadingState";

const preferredMeasurementSizes = ["S", "M", "L", "XL"];

function normalizeMeasurementSize(value: string) {
  const normalized = value.trim().toUpperCase().replace(/[\s_-]+/g, "");
  return ({ SMALL: "S", MEDIUM: "M", LARGE: "L", XLARGE: "XL", EXTRALARGE: "XL" } as Record<string, string>)[normalized]
    ?? value.trim().toUpperCase();
}

function parseMeasurementValue(value: string) {
  const values: Record<string, string> = {};
  for (const part of value.split(",")) {
    const match = part.trim().match(/^([^:]+):\s*(.+)$/);
    if (!match) continue;
    values[normalizeMeasurementSize(match[1])] = match[2].trim();
  }
  return values;
}

function ChevronIcon({ direction }: { direction: "previous" | "next" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={direction === "previous" ? "m15 5-7 7 7 7" : "m9 5 7 7-7 7"} />
    </svg>
  );
}

export default function ProductDetail({
  initialProducts,
  initialId,
  apiBase,
  whatsappNumber,
  productUrl,
}: {
  initialProducts: Product[];
  initialId: string;
  apiBase: string;
  whatsappNumber: string;
  productUrl: string;
}) {
  const [product, setProduct] = useState<Product | undefined>(
    initialProducts.find((item) => item.id === initialId),
  );
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(initialProducts);
  const [size, setSize] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(!product);
  const [mainImage, setMainImage] = useState(product?.image || "");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    fetch(`${apiBase}/api/catalog/articles`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load article");
        const result = (await response.json()) as {
          products?: Parameters<typeof mapPublishedArticle>[0][];
        };
        const liveProducts = (result.products ?? []).map(mapPublishedArticle);
        setCatalogProducts(liveProducts);
        const match = liveProducts.find((item) => item.id === initialId);
        setProduct(match);
        if (match) setMainImage((current) => current || match.image);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [apiBase, initialId]);

  useEffect(() => {
    if (!product) return;
    trackMetaEvent("ViewContent", {
      content_ids: [product.id],
      content_name: product.name,
      content_category: product.category,
      content_type: "product",
      value: pkrValue(product.price),
      currency: "PKR",
    });
  }, [product?.id]);

  useEffect(() => {
    if (!viewerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewerOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [viewerOpen]);

  if (loading) {
    return <section className="page-shell"><LoadingState label="Loading article" description="Preparing the article details and available sizes." /></section>;
  }
  if (!product) {
    return (
      <section className="page-shell narrow empty-state">
        <p className="eyebrow">ARTICLE NOT FOUND</p>
        <h1>THIS ARTICLE IS NOT AVAILABLE.</h1>
        <a className="text-link" href="/shop">BACK TO SHOP</a>
      </section>
    );
  }

  function add() {
    if (!product) return;
    if (product.sizes?.length && !size) {
      setMessage("Please select a size first.");
      return;
    }
    if (selectedStock != null && selectedStock <= 0) {
      setMessage(size ? `Size ${size} is sold out.` : "This article is sold out.");
      return;
    }
    addToCart(product, size || "Standard");
    trackMetaEvent("AddToCart", {
      content_ids: [product.id],
      content_name: product.name,
      content_category: product.category,
      content_type: "product",
      value: pkrValue(product.price),
      currency: "PKR",
    });
    setMessage("Article added to your bag. You can continue shopping or open your bag.");
  }

  const gallery = [...new Set([product.image, ...(product.gallery ?? [])].filter(Boolean))];
  const selectedImage = mainImage || product.image;
  const selectedImageIndex = Math.max(0, gallery.indexOf(selectedImage));
  const selectedStock = size ? product.stockBySize?.[size] : product.stockQty;
  const requiresSize = Boolean(product.sizes?.length);
  const addToBagReason = product.stockQty <= 0
    ? "This article is sold out"
    : requiresSize && !size
      ? "Select a size first"
      : Number(selectedStock ?? 0) <= 0
      ? "This article is sold out"
      : "";
  const whatsappDigits = whatsappNumber.replace(/\D/g, "");
  const whatsappHelpUrl = /^\d{10,15}$/.test(whatsappDigits)
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent([
        "Assalam-o-Alaikum, I need help with this Haley Wali article.",
        `Article: ${product.name}`,
        product.articleCode ? `Article code: ${product.articleCode}` : "",
        `Price: ${formatPkr(product.price)}`,
        requiresSize ? `Size: ${size || "Not selected yet"}` : "",
        "I would like to ask about the size, fabric or article details.",
        `Link: ${productUrl}`,
      ].filter(Boolean).join("\n"))}`
    : "";
  const relatedProducts = catalogProducts
    .filter((item) => item.id !== product.id)
    .sort((a, b) => Number(b.category === product.category) - Number(a.category === product.category))
    .slice(0, 4);
  const selectedChartSize = ({
    SMALL: "S",
    MEDIUM: "M",
    LARGE: "L",
    "X-LARGE": "XL",
    "EXTRA LARGE": "XL",
  } as Record<string, string>)[size.toUpperCase()] ?? size.toUpperCase();
  const measurementRows = product.measurements.map((measurement) => ({
    ...measurement,
    values: parseMeasurementValue(measurement.value),
  }));
  const foundMeasurementSizes = [...new Set(measurementRows.flatMap((measurement) => Object.keys(measurement.values)))];
  const measurementColumns = [
    ...preferredMeasurementSizes.filter((measurementSize) => foundMeasurementSizes.includes(measurementSize)),
    ...foundMeasurementSizes.filter((measurementSize) => !preferredMeasurementSizes.includes(measurementSize)),
  ];

  function showImage(offset: number) {
    if (!product) return;
    const fallbackImage = product.image;
    setMainImage((current) => {
      const currentIndex = Math.max(0, gallery.indexOf(current || fallbackImage));
      return gallery[(currentIndex + offset + gallery.length) % gallery.length];
    });
    setZoom(1);
  }

  function closeViewer() {
    setViewerOpen(false);
    setZoom(1);
  }

  return (
    <>
      <section className="detail-layout">
        <div className="detail-gallery detail-zara-gallery">
          <div className="detail-gallery-frame">
            <button className="detail-image-open" type="button" onClick={() => setViewerOpen(true)} aria-label="Open article image viewer">
              <img className="detail-product-image" key={selectedImage} src={selectedImage} alt={`${product.name} ${product.title}`} />
              <span className="detail-zoom-hint" aria-hidden="true">⌕&nbsp; ZOOM</span>
            </button>
            {gallery.length > 1 ? (
              <>
                <button className="detail-gallery-arrow detail-gallery-arrow-previous" type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); showImage(-1); }} aria-label="Previous article picture"><ChevronIcon direction="previous" /></button>
                <button className="detail-gallery-arrow detail-gallery-arrow-next" type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); showImage(1); }} aria-label="Next article picture"><ChevronIcon direction="next" /></button>
                <div className="detail-gallery-navigation" aria-label="Image selection">
                  <button type="button" onClick={() => setViewerOpen(true)}>VIEW ALL PHOTOS</button>
                  <span>{String(selectedImageIndex + 1).padStart(2, "0")} / {String(gallery.length).padStart(2, "0")}</span>
                  <div className="detail-gallery-progress" aria-hidden="true"><i style={{ width: `${((selectedImageIndex + 1) / gallery.length) * 100}%` }} /></div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      <div className="detail-copy">
        <span className="product-brand">{product.brand}</span>
        <h1>{product.name}</h1>
        <p className="product-subtitle">
          {product.title} · {product.pieces}{product.articleCode ? ` · ${product.articleCode}` : ""}
        </p>
        <a className="detail-rating-link" href="#reviews-heading" aria-label={product.reviewCount ? `${product.reviewAverage} out of 5 from ${product.reviewCount} reviews. Jump to reviews.` : "No reviews yet. Write the first review."}>
          <span className="detail-rating-stars" aria-hidden="true">{product.reviewCount ? "★".repeat(Math.round(product.reviewAverage)) + "☆".repeat(5 - Math.round(product.reviewAverage)) : "☆☆☆☆☆"}</span>
          <strong>{product.reviewCount ? product.reviewAverage.toFixed(1) : "New"}</strong>
          <span>{product.reviewCount ? `${product.reviewCount} ${product.reviewCount === 1 ? "review" : "reviews"}` : "Write the first review"}</span>
        </a>
        <div className="detail-price-row">
          {product.originalPrice ? <del>{formatPkr(product.originalPrice)}</del> : null}
          <strong className="detail-price">{formatPkr(product.price)}</strong>
          {product.salePercent ? <span>{product.salePercent}% OFF</span> : null}
        </div>
        <p className="detail-description">{product.description}</p>
        <dl className="detail-meta">
          <div><dt>FABRIC</dt><dd>{product.fabric}</dd></div>
          <div><dt>COLOUR</dt><dd>{product.color}</dd></div>
          <div><dt>ARTICLE TYPE</dt><dd>{product.type}</dd></div>
          <div><dt>SEASON</dt><dd>{product.season}</dd></div>
        </dl>
        {product.sizes?.length ? (
          <fieldset className="size-picker">
            <legend>SELECT SIZE</legend>
            <div className="size-options">
              {product.sizes.map((value) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="size"
                    value={value}
                    disabled={Number(product.stockBySize?.[value] ?? 0) <= 0}
                    checked={size === value}
                    onChange={() => {
                      setSize(value);
                      setMessage("");
                    }}
                  />
                  <span>{value}{Number(product.stockBySize?.[value] ?? 0) <= 0 ? <small>SOLD OUT</small> : null}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <p className="eyebrow">STANDARD UNSTITCHED ARTICLE</p>
        )}
        <p className={`stock-count${Number(selectedStock ?? 0) <= 3 ? " low-stock" : ""}`}>
          <span aria-hidden="true"></span>
          {product.stockQty <= 0
            ? "Out of stock"
            : product.sizes?.length && !size
            ? `${product.stockQty} available across all sizes — select your size`
            : `${selectedStock ?? product.stockQty} available${size ? ` in ${size}` : ""}`}
        </p>
        <div className="detail-purchase-actions">
          <span className="detail-add-to-bag" data-tooltip={addToBagReason || undefined}>
            <button
              className="primary-button full-button"
              type="button"
              onClick={add}
              disabled={Boolean(addToBagReason)}
              aria-describedby={requiresSize && !size && product.stockQty > 0 ? "select-size-first" : undefined}
            >
              ADD TO BAG
            </button>
            {requiresSize && !size && product.stockQty > 0 ? <span className="sr-only" id="select-size-first">Select a size first to add this article to your bag.</span> : null}
          </span>
          <WishlistButton productId={product.id} />
        </div>
        {whatsappHelpUrl ? (
          <div className="detail-whatsapp-help">
            <div>
              <strong>NEED HELP CHOOSING?</strong>
              <span>Ask us about sizing, fabric or article details.</span>
            </div>
            <a
              href={whatsappHelpUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Ask about ${product.name} on WhatsApp`}
              onClick={() => trackMetaEvent("Contact", {
                content_ids: [product.id],
                content_name: product.name,
                content_type: "product",
              })}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.4L3 20.4l1.3-4.7a8.5 8.5 0 1 1 16.2-4Z" />
                <path d="M8.2 7.7c.2-.4.4-.4.7-.4h.5c.2 0 .4 0 .5.4l.8 1.8c.1.3.1.5-.1.7l-.6.8c-.2.2-.1.4 0 .6.6 1.1 1.5 2 2.6 2.6.2.1.4.2.6 0l.9-1.1c.2-.2.4-.3.7-.2l1.8.9c.3.1.5.3.5.5 0 .3-.2 1.5-1 2.1-.6.5-1.4.7-2.2.5-1-.2-2.4-.7-4-2.1-1.3-1.2-2.3-2.6-2.7-3.7-.5-1.1 0-2.8.5-3.4Z" />
              </svg>
              ASK ON WHATSAPP
            </a>
          </div>
        ) : null}
        <p className="form-message" aria-live="polite">{message}</p>
        <div className="article-information">
          <h2>ARTICLE INFORMATION</h2>
          {product.includes.length ? <section><h3>WHAT IS INCLUDED</h3><ul className="article-includes">{product.includes.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
          {(product.shirtDetails || product.trouserDetails || product.dupattaDetails) ? (
            <div className="garment-details">
              {product.shirtDetails ? <section><h3>SHIRT</h3><p>{product.shirtDetails}</p></section> : null}
              {product.trouserDetails ? <section><h3>TROUSER</h3><p>{product.trouserDetails}</p></section> : null}
              {product.dupattaDetails ? <section><h3>DUPATTA</h3><p>{product.dupattaDetails}</p></section> : null}
            </div>
          ) : null}
          {measurementRows.length ? (
            <section className="detail-size-chart detail-measurements">
              <div className="detail-size-chart-heading">
                <h3>ARTICLE MEASUREMENTS</h3>
                <p>Finished article measurements in inches, specific to this article.</p>
              </div>
              <div className="detail-size-table-wrap">
                <table className="detail-size-table">
                  <thead>
                    <tr>
                      <th scope="col">Measurement</th>
                      {measurementColumns.length
                        ? measurementColumns.map((measurementSize) => (
                            <th className={selectedChartSize === measurementSize ? "is-selected" : undefined} scope="col" key={measurementSize}>{measurementSize}</th>
                          ))
                        : <th scope="col">Value</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {measurementRows.map((measurement, index) => (
                      <tr key={`${measurement.label}-${index}`}>
                        <th scope="row">{measurement.label}</th>
                        {measurementColumns.length && Object.keys(measurement.values).length
                          ? measurementColumns.map((measurementSize) => (
                              <td className={selectedChartSize === measurementSize ? "is-selected" : undefined} key={measurementSize}>{measurement.values[measurementSize] || "—"}</td>
                            ))
                          : <td colSpan={Math.max(1, measurementColumns.length)}>{measurement.value}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
          {product.modelDetails ? <section><h3>MODEL DETAILS</h3><p>{product.modelDetails}</p></section> : null}
        </div>
        <div className="detail-meta">
          <div><dt>DELIVERY</dt><dd>Across Pakistan</dd></div>
          <div><dt>PAYMENT</dt><dd>Cash on Delivery</dd></div>
          <div><dt>CARE</dt><dd>{product.care}</dd></div>
        </div>
      </div>
      </section>
      <ProductReviews productId={product.id} apiBase={apiBase} />
      {relatedProducts.length ? <section className="related-articles"><div className="related-heading"><div><p className="eyebrow">YOU MAY ALSO LIKE</p><h2>RELATED ARTICLES</h2></div><a href="/shop">VIEW ALL</a></div><div className="product-grid">{relatedProducts.map((item) => <ProductCard product={item} key={item.id} />)}</div></section> : null}
      {viewerOpen ? (
        <div className="image-viewer" role="dialog" aria-modal="true" aria-label={`${product.name} image viewer`} onClick={closeViewer}>
          <div className="image-viewer-shell" onClick={(event) => event.stopPropagation()}>
            <div className="image-viewer-header">
              <span>{product.name}</span>
              <small>{String(selectedImageIndex + 1).padStart(2, "0")} / {String(gallery.length).padStart(2, "0")}</small>
              <button className="image-viewer-close" type="button" onClick={closeViewer} aria-label="Close image viewer" autoFocus>×</button>
            </div>
            <div className={`image-viewer-stage${gallery.length === 1 ? " is-single" : ""}`}>
              {gallery.length > 1 ? <button className="image-viewer-arrow previous" type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); showImage(-1); }} aria-label="Previous article picture"><ChevronIcon direction="previous" /></button> : null}
              <div className={`image-viewer-image${zoom > 1 ? " is-zoomed" : ""}`}>
                <img
                  src={selectedImage}
                  alt={`${product.name} ${product.title}`}
                  style={zoom > 1 ? {
                    width: `${zoom * 100}%`,
                    maxWidth: "none",
                    maxHeight: "none",
                  } : undefined}
                />
              </div>
              {gallery.length > 1 ? <button className="image-viewer-arrow next" type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); showImage(1); }} aria-label="Next article picture"><ChevronIcon direction="next" /></button> : null}
            </div>
            <div className="image-viewer-zoom-controls" aria-label="Image zoom controls">
              <button type="button" onClick={() => setZoom((value) => Math.max(1, value - .25))} disabled={zoom <= 1} aria-label="Zoom out">−</button>
              <span>{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom((value) => Math.min(3, value + .25))} disabled={zoom >= 3} aria-label="Zoom in">+</button>
              {zoom > 1 ? <button className="image-viewer-reset" type="button" onClick={() => setZoom(1)}>RESET</button> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
