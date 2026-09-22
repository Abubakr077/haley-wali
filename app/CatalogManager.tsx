"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { suggestSellingPrice } from "../modules/catalog-import/pricing.ts";

type Variant = {
  title: string;
  available: boolean;
  stockQty?: number;
};

type Article = {
  id: string;
  handle: string;
  publicTitle: string;
  supplierTitle: string;
  sourcePricePkr: number;
  sourceUrl: string;
  imageUrl: string | null;
  costPricePkr: number | null;
  sellingPricePkr: number | null;
  overheadPkr: number;
  targetMarginBps: number;
  pricingStatus: string;
  publishStatus: string;
  supplyMode: string;
  stockQty: number;
  sourceAvailable: boolean;
  variants: Variant[];
};

type EditorValues = {
  publicTitle: string;
  costPricePkr: string;
  sellingPricePkr: string;
  overheadPkr: string;
  targetMarginBps: string;
  supplyMode: string;
  sizeStock: Record<string, string>;
};
type EditorTextField = Exclude<keyof EditorValues, "sizeStock">;

function formatPkr(value: number) {
  return `PKR ${value.toLocaleString("en-PK")}`;
}

function managerImageUrl(value: string | null) {
  if (!value || !value.startsWith("/")) return value;
  const storefront = process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://127.0.0.1:4321";
  return `${storefront.replace(/\/$/, "")}${value}`;
}

function ArticleEditor({
  article,
  onUpdated,
  onRemoved,
}: {
  article: Article;
  onUpdated(products: Article[]): void;
  onRemoved(products: Article[]): void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<EditorValues>({
    publicTitle: article.publicTitle,
    costPricePkr: article.costPricePkr?.toString() ?? "",
    sellingPricePkr: article.sellingPricePkr?.toString() ?? "",
    overheadPkr: article.overheadPkr.toString(),
    targetMarginBps: article.targetMarginBps.toString(),
    supplyMode: article.supplyMode,
    sizeStock: Object.fromEntries(article.variants.map((variant) => [variant.title, String(variant.stockQty ?? 0)])),
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const suggestion = useMemo(() => {
    try {
      return suggestSellingPrice({
        costPricePkr: Number(values.costPricePkr),
        overheadPkr: Number(values.overheadPkr),
        targetMarginBps: Number(values.targetMarginBps),
      });
    } catch {
      return null;
    }
  }, [values.costPricePkr, values.overheadPkr, values.targetMarginBps]);

  function change(field: EditorTextField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setMessage("");
  }

  function changeSizeStock(size: string, value: string) {
    setValues((current) => ({
      ...current,
      sizeStock: { ...current.sizeStock, [size]: value },
    }));
    setMessage("");
  }

  async function submit(action: "save" | "publish" | "unpublish") {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/catalog/imported", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: article.id,
          publicTitle: values.publicTitle,
          costPricePkr: values.costPricePkr
            ? Number(values.costPricePkr)
            : null,
          sellingPricePkr: values.sellingPricePkr
            ? Number(values.sellingPricePkr)
            : null,
          overheadPkr: Number(values.overheadPkr),
          targetMarginBps: Number(values.targetMarginBps),
          supplyMode: values.supplyMode,
          stockQty: Object.values(values.sizeStock).reduce((total, quantity) => total + Math.max(0, Number(quantity) || 0), 0),
          sizeStock: article.variants.map((variant) => ({
            title: variant.title,
            stockQty: Math.max(0, Number(values.sizeStock[variant.title]) || 0),
          })),
          action,
        }),
      });
      const result = (await response.json()) as {
        products?: Article[];
        promotedId?: string;
        error?: string;
      };
      if (!response.ok || !result.products) {
        throw new Error(result.error || "Could not save article.");
      }
      onUpdated(result.products);
      if (result.promotedId) {
        router.push(`/articles/${encodeURIComponent(result.promotedId)}`);
        return;
      }
      setMessage(
        action === "publish"
          ? "Published in the Branded collection."
          : action === "unpublish"
            ? "Removed from the customer shop."
            : "Draft saved.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("Remove this imported article from the manager and shop?")) {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(
        `/api/admin/catalog/imported?id=${encodeURIComponent(article.id)}`,
        { method: "DELETE" },
      );
      const result = (await response.json()) as {
        products?: Article[];
        error?: string;
      };
      if (!response.ok || !result.products) {
        throw new Error(result.error || "Could not remove article.");
      }
      onRemoved(result.products);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  const availableSizes = article.variants
    .filter((variant) => variant.available)
    .map((variant) => variant.title)
    .join(", ");

  return (
    <article className="article-editor">
      <a
        className="editor-image"
        href={article.sourceUrl}
        target="_blank"
        rel="noreferrer"
      >
        {article.imageUrl ? (
          // Supplier image URLs are dynamic; the production image pipeline will
          // copy approved images before the public storefront launches.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.imageUrl} alt={article.supplierTitle} />
        ) : (
          <span>NO IMAGE</span>
        )}
        <small>{article.sourceAvailable ? "SUPPLIER AVAILABLE" : "UNAVAILABLE"}</small>
      </a>

      <div className="editor-form">
        <div className="editor-heading">
          <div>
            <small>BRANDED · PRET · {article.publishStatus.toUpperCase()}</small>
            <h3>{article.supplierTitle}</h3>
          </div>
          <strong>{formatPkr(article.sourcePricePkr)}</strong>
        </div>

        <p className="size-line">
          AVAILABLE SIZES: {availableSizes || "NONE"}
        </p>

        <label className="full-field">
          CUSTOMER-FACING ARTICLE NAME
          <input
            value={values.publicTitle}
            onChange={(event) => change("publicTitle", event.target.value)}
          />
        </label>

        <div className="editor-fields">
          <label>
            ACTUAL BUYING COST
            <input
              inputMode="numeric"
              placeholder="e.g. 4000"
              value={values.costPricePkr}
              onChange={(event) => change("costPricePkr", event.target.value)}
            />
          </label>
          <label>
            PACKING / RETURN ALLOWANCE
            <input
              inputMode="numeric"
              value={values.overheadPkr}
              onChange={(event) => change("overheadPkr", event.target.value)}
            />
          </label>
          <label>
            TARGET MARGIN
            <select
              value={values.targetMarginBps}
              onChange={(event) => change("targetMarginBps", event.target.value)}
            >
              <option value="2000">20%</option>
              <option value="2500">25%</option>
              <option value="3000">30%</option>
              <option value="3500">35%</option>
            </select>
          </label>
          <label>
            HALEY WALI SELLING PRICE
            <input
              inputMode="numeric"
              placeholder="Set or use suggestion"
              value={values.sellingPricePkr}
              onChange={(event) => change("sellingPricePkr", event.target.value)}
            />
          </label>
          <label>
            STOCK MODE
            <select
              value={values.supplyMode}
              onChange={(event) => change("supplyMode", event.target.value)}
            >
              <option value="on_demand">Buy after customer order</option>
              <option value="owned_stock">Already in Haley Wali stock</option>
            </select>
          </label>
        </div>

        {values.supplyMode === "owned_stock" ? (
          <section className="import-size-stock" aria-labelledby="import-size-stock-title">
            <div>
              <strong id="import-size-stock-title">STOCK BY SIZE</strong>
              <span>Enter how many owned articles you have in each size. The total updates automatically.</span>
            </div>
            <div className="import-size-stock-grid">
              {article.variants.map((variant) => (
                <label key={variant.title}>
                  {variant.title}
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={values.sizeStock[variant.title] ?? "0"}
                    onChange={(event) => changeSizeStock(variant.title, event.target.value)}
                  />
                </label>
              ))}
            </div>
            <p>
              TOTAL OWNED STOCK: <strong>{Object.values(values.sizeStock).reduce((total, quantity) => total + Math.max(0, Number(quantity) || 0), 0)}</strong>
            </p>
          </section>
        ) : null}

        <div className="suggestion-row">
          <div>
            <span>SUGGESTED PRICE</span>
            <strong>
              {suggestion ? formatPkr(suggestion.sellingPricePkr) : "ENTER COST"}
            </strong>
          </div>
          {suggestion ? (
            <button
              type="button"
              onClick={() =>
                change("sellingPricePkr", suggestion.sellingPricePkr.toString())
              }
            >
              USE SUGGESTED PRICE
            </button>
          ) : null}
        </div>

        <div className="editor-actions">
          <button
            type="button"
            className="secondary-action"
            disabled={saving}
            onClick={() => submit("save")}
          >
            SAVE DRAFT
          </button>
          {values.supplyMode === "owned_stock" ? (
            <button
              type="button"
              className="primary-action"
              disabled={saving}
              onClick={() => submit("publish")}
            >
              {article.publishStatus === "published" ? "SAVE & PUBLISH ARTICLE" : "PUBLISH IN BRANDED"}
            </button>
          ) : article.publishStatus === "published" ? (
            <button
              type="button"
              className="danger-action"
              disabled={saving}
              onClick={() => submit("unpublish")}
            >
              REMOVE FROM SHOP
            </button>
          ) : null}
          <button
            type="button"
            className="danger-action"
            disabled={saving}
            onClick={remove}
          >
            REMOVE ARTICLE
          </button>
        </div>
        {values.supplyMode === "on_demand" && article.publishStatus !== "published" ? (
          <p className="import-publish-note">Choose “Already in Haley Wali stock” and enter stock by size before publishing.</p>
        ) : null}
        <p className="editor-message" aria-live="polite">
          {message}
        </p>
      </div>
    </article>
  );
}

type ManualArticle = {
  id: string;
  collection: "exclusive" | "branded";
  garmentType: "pret" | "unstitched";
  brand: string;
  title: string;
  articleCode: string;
  subtitle: string;
  description: string;
  imageUrl: string | null;
  gallery: string[];
  pieces: string;
  season: string;
  fabric: string;
  color: string;
  care: string;
  shirtDetails: string;
  trouserDetails: string;
  dupattaDetails: string;
  modelDetails: string;
  measurements: Array<{ label: string; value: string }>;
  includes: string[];
  variants: Variant[];
  costPricePkr: number | null;
  pricePkr: number | null;
  publishStatus: string;
  stockQty: number;
};

type StoreOrder = {
  id: string;
  number: string;
  name: string;
  phone: string;
  address?: string;
  city: string;
  postal?: string | null;
  note?: string | null;
  subtotal?: number;
  delivery?: number;
  discount?: number;
  offerCode?: string | null;
  total: number;
  payment?: string;
  status: string;
  postexTrackingNumber?: string | null;
  createdAt: string;
  updatedAt?: string;
  items?: Array<{
    id: string;
    productId: string;
    title: string;
    size: string;
    quantity: number;
    unitPricePkr: number;
  }>;
};

async function readJson<T>(response: Response): Promise<T> {
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(result.error || "Request failed.");
  return result;
}

type UploadedArticleImage = {
  url: string;
  key: string;
  size: number;
};

const ARTICLE_IMAGE_TARGET_BYTES = 1024 * 1024;
const ARTICLE_IMAGE_UPLOAD_LIMIT_BYTES = 1200 * 1024;
const ARTICLE_IMAGE_SOURCE_LIMIT_BYTES = 8 * 1024 * 1024;
const ARTICLE_IMAGE_MIN_SHORT_DIMENSION = 1200;
const ARTICLE_IMAGE_MAX_DIMENSION = 2560;

type DetectedArticleImageType = {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
};

function detectedArticleImageType(bytes: Uint8Array): DetectedArticleImageType | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { contentType: "image/png", extension: "png" };
  }
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return { contentType: "image/webp", extension: "webp" };
  }
  return null;
}

async function normalizedArticleImageFile(file: File): Promise<File> {
  const bytes = await file.arrayBuffer();
  const type = detectedArticleImageType(new Uint8Array(bytes.slice(0, 12)));
  if (!type) {
    throw new Error(`${file.name || "This file"} is not a valid JPG, PNG or WebP image.`);
  }
  // Phone/supplier exports are sometimes renamed to .webp while still being a
  // JPEG. Decode with the signature-derived MIME type rather than the name.
  return new File([bytes], file.name || `article-image.${type.extension}`, { type: type.contentType });
}

function canvasToWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("This browser could not optimize the selected image.")),
      "image/webp",
      quality,
    );
  });
}

async function optimizeArticleImage(file: File): Promise<File> {
  if (file.size > ARTICLE_IMAGE_SOURCE_LIMIT_BYTES) {
    throw new Error(`${file.name || "An image"} must be smaller than 8 MB before optimization.`);
  }
  const source = await normalizedArticleImageFile(file);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source);
  } catch {
    throw new Error(`${file.name || "This image"} could not be opened. Choose a valid JPG, PNG or WebP image.`);
  }
  try {
    if (Math.min(bitmap.width, bitmap.height) < ARTICLE_IMAGE_MIN_SHORT_DIMENSION) {
      throw new Error(`${file.name || "This image"} is too small for clear zoom. Use an original at least ${ARTICLE_IMAGE_MIN_SHORT_DIMENSION}px on its shorter side.`);
    }
    let scale = Math.min(1, ARTICLE_IMAGE_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    let best: Blob | null = null;
    for (let sizeAttempt = 0; sizeAttempt < 5; sizeAttempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser could not optimize the selected image.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.72, 0.62, 0.52]) {
        best = await canvasToWebp(canvas, quality);
        if (best.size <= ARTICLE_IMAGE_TARGET_BYTES) break;
      }
      if (best.size <= ARTICLE_IMAGE_TARGET_BYTES) break;
      scale *= 0.82;
    }
    if (!best || best.size > ARTICLE_IMAGE_UPLOAD_LIMIT_BYTES) {
      throw new Error(`${file.name || "An image"} could not be reduced below 1.2 MB. Choose a simpler or smaller picture.`);
    }
    const encodedType = detectedArticleImageType(new Uint8Array(await best.slice(0, 12).arrayBuffer()));
    if (!encodedType) {
      throw new Error("This browser returned an invalid optimized image. Please try a different browser.");
    }
    const baseName = (file.name || "article-image").replace(/\.[^.]+$/, "");
    return new File([best], `${baseName}.${encodedType.extension}`, { type: encodedType.contentType });
  } finally {
    bitmap.close();
  }
}

function ArticleImageFields({ article }: { article?: ManualArticle }) {
  const [imageUrl, setImageUrl] = useState(article?.imageUrl || "");
  const [gallery, setGallery] = useState(
    article?.gallery?.filter((url) => url !== article.imageUrl).join("\n") || "",
  );
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [inputKey, setInputKey] = useState(0);
  const [isImageDropTarget, setIsImageDropTarget] = useState(false);
  const fileInputId = useId();
  const uploadedUrls = useRef(new Set<string>());

  useEffect(() => {
    setImageUrl(article?.imageUrl || "");
    setGallery(article?.gallery?.filter((url) => url !== article.imageUrl).join("\n") || "");
  }, [article]);

  useEffect(() => () => {
    uploadedUrls.current.forEach((url) => {
      void fetch("/api/admin/article-images", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
        keepalive: true,
      });
    });
  }, []);

  const galleryUrls = gallery.split("\n").map((url) => url.trim()).filter(Boolean);
  const previewUrls = [...new Set([imageUrl.trim(), ...galleryUrls].filter(Boolean))];

  function selectFiles(nextFiles: File[]) {
    const selected = nextFiles.slice(0, 8);
    setFiles(selected);
    setMessage(nextFiles.length > 8 ? "Choose up to 8 images at a time." : "");
  }

  async function upload() {
    if (!files.length) return;
    setUploading(true);
    setMessage("Optimizing images for the shop…");
    try {
      const data = new FormData();
      const optimizedFiles = await Promise.all(files.map(optimizeArticleImage));
      optimizedFiles.forEach((file) => data.append("images", file));
      const result = await readJson<{ images: UploadedArticleImage[] }>(
        await fetch("/api/admin/article-images", { method: "POST", body: data }),
      );
      const urls = result.images.map((image) => image.url);
      urls.forEach((url) => uploadedUrls.current.add(url));
      const nextMain = imageUrl.trim() || urls.shift() || "";
      setImageUrl(nextMain);
      setGallery([...new Set([...galleryUrls, ...urls].filter((url) => url !== nextMain))].join("\n"));
      setFiles([]);
      setInputKey((value) => value + 1);
      setMessage(`${result.images.length} image${result.images.length === 1 ? "" : "s"} uploaded. Save the article to keep these changes.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setUploading(false);
    }
  }

  function removeImage(url: string) {
    if (url === imageUrl.trim()) {
      const [nextMain = "", ...remaining] = galleryUrls;
      setImageUrl(nextMain);
      setGallery(remaining.join("\n"));
    } else {
      setGallery(galleryUrls.filter((galleryUrl) => galleryUrl !== url).join("\n"));
    }
    void fetch("/api/admin/article-images", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });
    setMessage("Image removed from the article. Save changes to finish.");
  }

  function makeMain(url: string) {
    const currentMain = imageUrl.trim();
    setImageUrl(url);
    setGallery([
      ...new Set([
        ...(currentMain && currentMain !== url ? [currentMain] : []),
        ...galleryUrls.filter((galleryUrl) => galleryUrl !== url),
      ]),
    ].join("\n"));
    setMessage("Main image changed. Save the article to finish.");
  }

  return (
    <section className="article-image-fields wide-field" aria-labelledby="article-images-title">
      <div className="article-image-heading">
        <div>
          <strong id="article-images-title">ARTICLE IMAGES</strong>
          <span>Upload JPG, PNG or WebP. Use original photos at least 1200px on the shorter side for clear zoom. Maximum 8 source images at one time and 8 MB each.</span>
        </div>
        <div
          className={`article-image-upload${isImageDropTarget ? " is-drop-target" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsImageDropTarget(true);
          }}
          onDragLeave={() => setIsImageDropTarget(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsImageDropTarget(false);
            selectFiles(Array.from(event.dataTransfer.files));
          }}
        >
          <input
            key={inputKey}
            id={fileInputId}
            className="article-image-file-input"
            aria-label="Choose article images"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(event) => selectFiles(Array.from(event.currentTarget.files || []))}
          />
          <label className="article-image-file-button" htmlFor={fileInputId}>
            <span>{files.length ? `${files.length} IMAGE${files.length === 1 ? "" : "S"} SELECTED` : "CHOOSE MULTIPLE IMAGES"}</span>
            <small>UP TO 8 AT ONCE</small>
          </label>
          <button type="button" disabled={uploading || !files.length} onClick={upload}>
            {uploading ? "UPLOADING…" : "UPLOAD"}
          </button>
        </div>
      </div>

      <p className="article-image-select-help">Select several photos in the file picker (Command-click on Mac or Ctrl-click on Windows), or drag up to 8 images into the selection area.</p>
      {files.length ? (
        <div className="article-image-selection" aria-live="polite">
          <span>{files.length} READY TO UPLOAD</span>
          <div>{files.map((file) => <small key={`${file.name}-${file.lastModified}`}>{file.name}</small>)}</div>
          <button type="button" onClick={() => { setFiles([]); setInputKey((value) => value + 1); }}>CLEAR SELECTION</button>
        </div>
      ) : null}

      {previewUrls.length ? (
        <div className="article-image-preview">
          {previewUrls.map((url) => (
            <figure key={url}>
              <img src={managerImageUrl(url) || url} alt="Article upload preview" />
              <figcaption>
                <span>{url === imageUrl.trim() ? "MAIN IMAGE" : "GALLERY"}</span>
                <div>
                  {url !== imageUrl.trim() ? <button type="button" onClick={() => makeMain(url)}>MAKE MAIN</button> : null}
                  <button type="button" onClick={() => removeImage(url)}>REMOVE</button>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : <p className="article-image-empty">No article images added yet.</p>}

      <div className="article-image-url-fields">
        <label>
          MAIN IMAGE URL <span>(filled automatically after upload)</span>
          <input name="imageUrl" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="Upload an image or paste an existing URL" />
        </label>
        <label>
          MORE IMAGE URLS <span>(one per line)</span>
          <textarea name="gallery" value={gallery} onChange={(event) => setGallery(event.target.value)} placeholder="Uploaded gallery images appear here" />
        </label>
      </div>
      <p className="article-image-message" aria-live="polite">{message}</p>
    </section>
  );
}

function brandKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

type ApprovedBrand = {
  name: string;
  aliases: string[];
};

function matchingApprovedBrand(value: string, brands: ApprovedBrand[]) {
  const key = brandKey(value);
  return brands.find((brand) =>
    brandKey(brand.name) === key
    || brand.aliases.some((alias) => brandKey(alias) === key),
  );
}

function ArticleFields({
  article,
  approvedBrands,
}: {
  article?: ManualArticle;
  approvedBrands: ApprovedBrand[];
}) {
  const [collection, setCollection] = useState<"exclusive" | "branded">(
    article?.collection || "exclusive",
  );
  const [brand, setBrand] = useState(article?.brand || "Haley Wali");
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([]);
  const [brandSuggestionMessage, setBrandSuggestionMessage] = useState("");
  const [suggestingBrand, setSuggestingBrand] = useState(false);
  const [approvedSuggestion, setApprovedSuggestion] = useState("");
  const [approvingBrand, setApprovingBrand] = useState(false);
  const brandInputId = useId();
  const brandListId = useId();
  const matchedBrand = matchingApprovedBrand(brand, approvedBrands)
    ?? (approvedSuggestion && brandKey(approvedSuggestion) === brandKey(brand)
      ? { name: approvedSuggestion, aliases: [] }
      : undefined);

  function changeCollection(next: "exclusive" | "branded") {
    setCollection(next);
    if (next === "exclusive") setBrand("Haley Wali");
    else if (brandKey(brand) === brandKey("Haley Wali")) setBrand("");
    setBrandSuggestions([]);
    setBrandSuggestionMessage("");
    setApprovedSuggestion("");
  }

  async function suggestBrand() {
    if (!brand.trim() || suggestingBrand) return;
    setSuggestingBrand(true);
    setBrandSuggestions([]);
    setBrandSuggestionMessage("Checking the official brand name…");
    try {
      const result = await readJson<{ suggestions: string[] }>(
        await fetch("/api/admin/brands/suggest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: brand }),
        }),
      );
      setBrandSuggestions(result.suggestions);
      setBrandSuggestionMessage(result.suggestions.length
        ? "Select the correct official brand name."
        : "No reliable brand match was found. Check the spelling and try the complete official name.");
    } catch (error) {
      setBrandSuggestionMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSuggestingBrand(false);
    }
  }

  async function selectBrandSuggestion(suggestion: string) {
    if (approvingBrand) return;
    setApprovingBrand(true);
    setBrandSuggestionMessage("Approving the selected official brand name…");
    try {
      const result = await readJson<{ name: string }>(
        await fetch("/api/admin/brands/approve", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: suggestion }),
        }),
      );
      setBrand(result.name);
      setApprovedSuggestion(result.name);
      setBrandSuggestions([]);
      setBrandSuggestionMessage(`${result.name} is approved and can be reused without another AI request.`);
    } catch (error) {
      setBrandSuggestionMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setApprovingBrand(false);
    }
  }

  return (
    <div className="manual-fields">
      <label>
        COLLECTION
        <select
          name="collection"
          value={collection}
          onChange={(event) => changeCollection(event.target.value as "exclusive" | "branded")}
        >
          <option value="exclusive">HW Exclusive</option>
          <option value="branded">Branded</option>
        </select>
      </label>
      <label>
        ARTICLE TYPE
        <select name="garmentType" defaultValue={article?.garmentType || "unstitched"}>
          <option value="unstitched">Unstitched</option>
          <option value="pret">Pret / Ready to Wear</option>
        </select>
      </label>
      <div className="brand-name-field">
        <label htmlFor={brandInputId}>BRAND</label>
        <input
          id={brandInputId}
          name="brand"
          list={collection === "branded" ? brandListId : undefined}
          minLength={2}
          maxLength={50}
          value={brand}
          readOnly={collection === "exclusive"}
          placeholder={collection === "branded" ? "Choose or enter the official brand name" : undefined}
          autoComplete="off"
          required
          onChange={(event) => {
            setBrand(event.target.value);
            setApprovedSuggestion("");
            setBrandSuggestions([]);
            setBrandSuggestionMessage("");
          }}
        />
        <datalist id={brandListId}>
          {approvedBrands.map((approvedBrand) => <option value={approvedBrand.name} key={approvedBrand.name} />)}
        </datalist>
        {collection === "branded" ? (
          <span className="brand-name-assistant">
            <small className={brand.trim() && !matchedBrand ? "brand-name-note is-new" : "brand-name-note"}>
              {matchedBrand
                ? `APPROVED BRAND — THIS ARTICLE WILL USE THE ${matchedBrand.name.toUpperCase()} FILTER.`
                : "CHOOSE AN APPROVED BRAND. TYPE THE COMPLETE NAME BEFORE REQUESTING AI SUGGESTIONS."}
            </small>
            {!matchedBrand && brand.trim().length >= 2 ? (
              <button type="button" disabled={suggestingBrand} onClick={suggestBrand}>
                {suggestingBrand ? "CHECKING…" : "AI SUGGESTIONS"}
              </button>
            ) : null}
            {brandSuggestions.length ? (
              <span className="brand-suggestion-options">
                {brandSuggestions.map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion}
                    disabled={approvingBrand}
                    onClick={() => selectBrandSuggestion(suggestion)}
                  >
                    {approvingBrand ? "APPROVING…" : suggestion}
                  </button>
                ))}
              </span>
            ) : null}
            {brandSuggestionMessage ? <small className="brand-suggestion-message" aria-live="polite">{brandSuggestionMessage}</small> : null}
          </span>
        ) : null}
      </div>
      <label>
        ARTICLE NAME
        <input name="title" defaultValue={article?.title} required />
      </label>
      <label>
        ARTICLE CODE
        <input name="articleCode" defaultValue={article?.articleCode || ""} placeholder="e.g. HW-001" />
      </label>
      <label>
        SHORT TITLE
        <input name="subtitle" defaultValue={article?.subtitle || "Clothing Article"} required />
      </label>
      <ArticleImageFields article={article} />
      <label>
        BUYING COST
        <input name="costPricePkr" inputMode="numeric" defaultValue={article?.costPricePkr ?? ""} />
      </label>
      <label>
        SELLING PRICE
        <input name="pricePkr" inputMode="numeric" defaultValue={article?.pricePkr ?? ""} />
      </label>
      <label>
        UNSTITCHED STOCK QUANTITY <span>(Pret uses size stock below)</span>
        <input name="stockQty" inputMode="numeric" defaultValue={article?.stockQty ?? 1} required />
      </label>
      <label>
        PIECES
        <input name="pieces" defaultValue={article?.pieces || "3 Piece"} />
      </label>
      <label>
        FABRIC
        <input name="fabric" defaultValue={article?.fabric || "Lawn"} />
      </label>
      <label>
        SEASON
        <input name="season" defaultValue={article?.season || "All Season"} placeholder="Summer, Winter, All Season" />
      </label>
      <label>
        COLOUR
        <input name="color" defaultValue={article?.color || "As shown"} />
      </label>
      <label>
        PRET SIZE STOCK <span>(one size and quantity per line)</span>
        <textarea name="sizeStock" defaultValue={article?.variants.map((item) => `${item.title}: ${item.stockQty ?? 0}`).join("\n")} placeholder={"S: 2\nM: 3\nL: 1"} />
      </label>
      <label>
        CARE INSTRUCTIONS
        <textarea name="care" defaultValue={article?.care || ""} placeholder="Wash colours separately. Dry in shade." />
      </label>
      <label>
        SHIRT DETAILS
        <textarea name="shirtDetails" defaultValue={article?.shirtDetails || ""} placeholder="Fabric, embroidery, length or fabric metres" />
      </label>
      <label>
        TROUSER DETAILS
        <textarea name="trouserDetails" defaultValue={article?.trouserDetails || ""} />
      </label>
      <label>
        DUPATTA DETAILS
        <textarea name="dupattaDetails" defaultValue={article?.dupattaDetails || ""} />
      </label>
      <label>
        MODEL DETAILS <span>(Pret only)</span>
        <textarea name="modelDetails" defaultValue={article?.modelDetails || ""} placeholder="Model height 5'6, wearing size S" />
      </label>
      <label className="wide-field">
        PRET MEASUREMENTS <span>(one line each: label | value)</span>
        <textarea name="measurements" defaultValue={article?.measurements?.map((item) => `${item.label} | ${item.value}`).join("\n")} placeholder={"Shirt chest | S: 19 in, M: 20 in, L: 22 in\nShirt length | 42 in"} />
      </label>
      <label className="wide-field">
        WHAT IS INCLUDED <span>(one per line)</span>
        <textarea name="includes" defaultValue={article?.includes?.join("\n")} placeholder={"Printed lawn shirt — 3m\nDyed trouser — 2.5m\nPrinted dupatta — 2.5m"} />
      </label>
      <label className="wide-field">
        DESCRIPTION
        <textarea name="description" defaultValue={article?.description} />
      </label>
    </div>
  );
}

function formArticle(form: HTMLFormElement, action: string, id?: string) {
  const data = new FormData(form);
  const number = (name: string) => {
    const value = String(data.get(name) || "").trim();
    return value ? Number(value) : null;
  };
  return {
    id,
    collection: String(data.get("collection")),
    garmentType: String(data.get("garmentType")),
    brand: String(data.get("brand")),
    title: String(data.get("title")),
    articleCode: String(data.get("articleCode")),
    subtitle: String(data.get("subtitle")),
    imageUrl: String(data.get("imageUrl")),
    gallery: String(data.get("gallery") || "").split("\n").map((value) => value.trim()).filter(Boolean),
    costPricePkr: number("costPricePkr"),
    pricePkr: number("pricePkr"),
    stockQty: number("stockQty") ?? 0,
    pieces: String(data.get("pieces")),
    season: String(data.get("season")),
    fabric: String(data.get("fabric")),
    color: String(data.get("color")),
    care: String(data.get("care")),
    shirtDetails: String(data.get("shirtDetails")),
    trouserDetails: String(data.get("trouserDetails")),
    dupattaDetails: String(data.get("dupattaDetails")),
    modelDetails: String(data.get("modelDetails")),
    sizeStock: String(data.get("sizeStock") || "").split("\n").map((line) => {
      const [title, quantity] = line.split(":");
      return { title: title?.trim(), stockQty: Number(quantity?.trim() || 0) };
    }).filter((item) => item.title),
    measurements: String(data.get("measurements") || "").split("\n").map((line) => {
      const [label, ...value] = line.split("|");
      return { label: label?.trim(), value: value.join("|").trim() };
    }).filter((item) => item.label && item.value),
    includes: String(data.get("includes") || "").split("\n").map((value) => value.trim()).filter(Boolean),
    description: String(data.get("description")),
    action,
  };
}

function NewArticleForm({
  onUpdated,
  onCreated,
  approvedBrands,
}: {
  onUpdated(products: ManualArticle[]): void;
  onCreated?(): void;
  approvedBrands: ApprovedBrand[];
}) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSaving(true);
    setMessage("");
    const submitter = (event.nativeEvent as unknown as { submitter?: HTMLButtonElement }).submitter;
    const action = submitter?.value === "save" ? "save" : "publish";
    try {
      const result = await readJson<{ products: ManualArticle[] }>(
        await fetch("/api/admin/articles", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(formArticle(form, action)),
        }),
      );
      onUpdated(result.products);
      form.reset();
      setMessage(action === "publish" ? "Article published. It is now available in the customer shop." : "Draft saved. You can publish it later.");
      onCreated?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="manual-product-form" onSubmit={submit}>
      <div className="manager-section-head">
        <div><p className="eyebrow">NEW STOCK DETAILS</p><h2>ARTICLE INFORMATION</h2></div>
        <p>Add HW Exclusive articles made by you, or manually add branded Pret and unstitched stock.</p>
      </div>
      <ArticleFields approvedBrands={approvedBrands} />
      <div className="editor-actions">
        <button className="secondary-action" disabled={saving} type="submit" value="save">SAVE AS DRAFT</button>
        <button className="primary-action" disabled={saving} type="submit" value="publish">ADD & PUBLISH ARTICLE</button>
      </div>
      <p className="editor-message" aria-live="polite">{message}</p>
    </form>
  );
}

function ManualArticleEditor({
  article,
  onUpdated,
  onDeleted,
  approvedBrands,
}: {
  article: ManualArticle;
  onUpdated(products: ManualArticle[]): void;
  onDeleted?(): void;
  approvedBrands: ApprovedBrand[];
}) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  async function save(form: HTMLFormElement, action: string) {
    setSaving(true);
    try {
      const result = await readJson<{ products: ManualArticle[] }>(
        await fetch("/api/admin/articles", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(formArticle(form, action, article.id)),
        }),
      );
      onUpdated(result.products);
      setMessage(action === "publish" ? "Published in the shop." : action === "unpublish" ? "Removed from the shop." : "Changes saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (!window.confirm(`Delete ${article.title}?`)) return;
    setSaving(true);
    try {
      const result = await readJson<{ products: ManualArticle[] }>(
        await fetch(`/api/admin/articles?id=${encodeURIComponent(article.id)}`, { method: "DELETE" }),
      );
      onUpdated(result.products);
      onDeleted?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="manual-product-form existing-product" onSubmit={(event) => { event.preventDefault(); save(event.currentTarget, "save"); }}>
      <div className="editor-heading">
        <div>
          <small>{article.collection === "exclusive" ? "HW EXCLUSIVE" : `BRANDED · ${article.garmentType.toUpperCase()}`} · {article.publishStatus.toUpperCase()}</small>
          <h3>{article.title}</h3>
        </div>
        <strong>{article.pricePkr ? formatPkr(article.pricePkr) : "NO PRICE"}</strong>
      </div>
      <ArticleFields article={article} approvedBrands={approvedBrands} />
      <div className="editor-actions">
        <button className="secondary-action" disabled={saving} type="submit">SAVE CHANGES</button>
        <button className={article.publishStatus === "published" ? "danger-action" : "primary-action"} disabled={saving} type="button" onClick={(event) => save(event.currentTarget.form!, article.publishStatus === "published" ? "unpublish" : "publish")}>
          {article.publishStatus === "published" ? "REMOVE FROM SHOP" : "PUBLISH"}
        </button>
        <button className="danger-action" disabled={saving} type="button" onClick={remove}>DELETE ARTICLE</button>
      </div>
      <p className="editor-message" aria-live="polite">{message}</p>
    </form>
  );
}

function ManualArticlesList({
  articles,
}: {
  articles: ManualArticle[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return articles.filter((article) => {
      const matchesStatus = status === "all" || article.publishStatus === status;
      const matchesSearch = !search || [article.title, article.brand, article.collection, article.garmentType]
        .join(" ")
        .toLowerCase()
        .includes(search);
      return matchesStatus && matchesSearch;
    });
  }, [articles, query, status]);
  useEffect(() => setPage(1), [query, status]);
  const pageCount = Math.max(1, Math.ceil(visible.length / 15));
  const currentPage = Math.min(page, pageCount);
  const pageArticles = visible.slice((currentPage - 1) * 15, currentPage * 15);

  return (
    <section className="manager-record-section">
      <div className="manager-list-toolbar">
        <div>
          <p className="eyebrow">CURRENT STOCK</p>
          <h2>YOUR ARTICLES</h2>
          <p>{articles.length} article{articles.length === 1 ? "" : "s"} managed by Haley Wali.</p>
        </div>
        <Link className="manager-primary-link" href="/articles/new">ADD NEW ARTICLE</Link>
      </div>

      <div className="manager-list-filters">
        <label>
          SEARCH ARTICLES
          <input
            type="search"
            placeholder="Name, brand or collection"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          SHOP STATUS
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All articles</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </label>
      </div>

      <div className="manager-record-list">
        <div className="manager-record-head" aria-hidden="true">
          <span>ARTICLE</span><span>TYPE</span><span>PRICE</span><span>STOCK</span><span>STATUS</span><span></span>
        </div>
        {pageArticles.map((article) => (
          <Link className="manager-record-row" href={`/articles/${encodeURIComponent(article.id)}`} key={article.id}>
            <span className="record-identity">
              <span className="record-thumbnail">
                {managerImageUrl(article.imageUrl) ? <img src={managerImageUrl(article.imageUrl) || ""} alt="" /> : <span>NO IMAGE</span>}
              </span>
              <span><strong>{article.title}</strong><small>{article.brand}</small></span>
            </span>
            <span>{article.collection === "exclusive" ? "HW Exclusive" : "Branded"}<small>{article.garmentType === "pret" ? "Pret" : "Unstitched"}</small></span>
            <span><strong>{article.pricePkr ? formatPkr(article.pricePkr) : "No price"}</strong></span>
            <span><strong>{article.stockQty}</strong><small>available</small></span>
            <span><i className={`record-status ${article.publishStatus}`}>{article.publishStatus}</i></span>
            <span className="record-open">EDIT <b aria-hidden="true">→</b></span>
          </Link>
        ))}
        {!visible.length ? <p className="manager-list-empty">No articles match these filters.</p> : null}
      </div>
      <ListPagination page={currentPage} pageCount={pageCount} total={visible.length} onChange={setPage} />
    </section>
  );
}

function ImportedArticlesList({
  articles,
  importing,
  importMessage,
  onImport,
}: {
  articles: Article[];
  importing: boolean;
  importMessage: string;
  onImport(): void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return articles.filter((article) => {
      const matchesStatus = status === "all" || article.publishStatus === status;
      const matchesSearch = !search || [article.publicTitle, article.supplierTitle]
        .join(" ")
        .toLowerCase()
        .includes(search);
      return matchesStatus && matchesSearch;
    });
  }, [articles, query, status]);
  useEffect(() => setPage(1), [query, status]);
  const pageCount = Math.max(1, Math.ceil(visible.length / 15));
  const currentPage = Math.min(page, pageCount);
  const pageArticles = visible.slice((currentPage - 1) * 15, currentPage * 15);

  return (
    <section className="manager-record-section">
      <div className="manager-list-toolbar">
        <div>
          <p className="eyebrow">BRANDED · PRET</p>
          <h2>SUPPLIER ARTICLES</h2>
          <p>{articles.length} imported article{articles.length === 1 ? "" : "s"}. Open one article to set price and publication.</p>
        </div>
        <div className="manager-import-control">
          <button disabled={importing} type="button" onClick={onImport}>
            {importing ? "IMPORTING…" : "RUN IMPORT NOW"}
          </button>
          <p aria-live="polite">{importMessage}</p>
        </div>
      </div>

      <div className="manager-list-filters">
        <label>
          SEARCH IMPORTED ARTICLES
          <input
            type="search"
            placeholder="Article name"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          SHOP STATUS
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All imported articles</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </label>
      </div>

      <div className="manager-record-list imported-record-list">
        <div className="manager-record-head" aria-hidden="true">
          <span>ARTICLE</span><span>SUPPLIER PRICE</span><span>SELLING PRICE</span><span>AVAILABILITY</span><span>STATUS</span><span></span>
        </div>
        {pageArticles.map((article) => (
          <Link className="manager-record-row" href={`/imports/${encodeURIComponent(article.id)}`} key={article.id}>
            <span className="record-identity">
              <span className="record-thumbnail">
                {article.imageUrl ? <img src={article.imageUrl} alt="" /> : <span>NO IMAGE</span>}
              </span>
              <span><strong>{article.publicTitle}</strong><small>{article.supplierTitle}</small></span>
            </span>
            <span><strong>{formatPkr(article.sourcePricePkr)}</strong><small>reference only</small></span>
            <span><strong>{article.sellingPricePkr ? formatPkr(article.sellingPricePkr) : "Not set"}</strong></span>
            <span><strong>{article.sourceAvailable ? "Available" : "Unavailable"}</strong><small>{article.variants.filter((variant) => variant.available).length} size options</small></span>
            <span><i className={`record-status ${article.publishStatus}`}>{article.publishStatus}</i></span>
            <span className="record-open">OPEN <b aria-hidden="true">→</b></span>
          </Link>
        ))}
        {!visible.length ? <p className="manager-list-empty">No imported articles match these filters.</p> : null}
      </div>
      <ListPagination page={currentPage} pageCount={pageCount} total={visible.length} onChange={setPage} />
    </section>
  );
}

function ListPagination({
  page,
  pageCount,
  total,
  onChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  onChange(page: number): void;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav className="manager-pagination" aria-label="List pages">
      <button type="button" disabled={page === 1} onClick={() => onChange(page - 1)}>← PREVIOUS</button>
      <span>PAGE {page} OF {pageCount} · {total} RESULTS</span>
      <button type="button" disabled={page === pageCount} onClick={() => onChange(page + 1)}>NEXT →</button>
    </nav>
  );
}

function OrdersPanel({ orders }: { orders: StoreOrder[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = status === "all" || order.status === status;
      const matchesSearch = !search || [order.number, order.name, order.phone, order.city]
        .join(" ")
        .toLowerCase()
        .includes(search);
      return matchesStatus && matchesSearch;
    });
  }, [orders, query, status]);
  useEffect(() => setPage(1), [query, status]);
  const pageCount = Math.max(1, Math.ceil(visible.length / 15));
  const currentPage = Math.min(page, pageCount);
  const pageOrders = visible.slice((currentPage - 1) * 15, currentPage * 15);

  return (
    <section className="manager-record-section">
      <div className="manager-list-toolbar">
        <div><p className="eyebrow">CUSTOMER ORDERS</p><h2>ORDER QUEUE</h2><p>{orders.length} Cash on Delivery order{orders.length === 1 ? "" : "s"}.</p></div>
      </div>
      <div className="manager-list-filters">
        <label>SEARCH ORDERS<input type="search" placeholder="Order number, customer or phone" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label>ORDER STATUS<select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All orders</option><option value="received">Received</option><option value="confirmed">Confirmed</option><option value="packed">Packed</option><option value="dispatched">Dispatched</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option>
        </select></label>
      </div>
      <div className="manager-record-list">
        <div className="manager-record-head" aria-hidden="true"><span>ORDER</span><span>CUSTOMER</span><span>TOTAL</span><span>CITY</span><span>STATUS</span><span></span></div>
        {pageOrders.map((order) => (
          <Link className="manager-record-row order-record-row" href={`/orders/${encodeURIComponent(order.id)}`} key={order.id}>
            <span><strong>{order.number}</strong><small>{new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" }).format(new Date(order.createdAt))}</small></span>
            <span><strong>{order.name}</strong><small>{order.phone}</small></span>
            <span><strong>{formatPkr(order.total)}</strong><small>{order.payment || "Cash on Delivery"}</small></span>
            <span><strong>{order.city}</strong></span>
            <span><i className={`record-status ${order.status}`}>{order.status}</i></span>
            <span className="record-open">OPEN <b aria-hidden="true">→</b></span>
          </Link>
        ))}
        {!visible.length ? <p className="manager-list-empty">No orders match these filters.</p> : null}
      </div>
      <ListPagination page={currentPage} pageCount={pageCount} total={visible.length} onChange={setPage} />
    </section>
  );
}

function OrderDetailPanel({
  order,
  onUpdated,
  onDeleted,
}: {
  order: StoreOrder;
  onUpdated(order: StoreOrder): void;
  onDeleted(): void;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [trackingNumber, setTrackingNumber] = useState(order.postexTrackingNumber ?? "");

  useEffect(() => {
    setTrackingNumber(order.postexTrackingNumber ?? "");
  }, [order.id, order.postexTrackingNumber]);

  async function change(status: string) {
    setSaving(true);
    setMessage("");
    try {
      const result = await readJson<{ orders: StoreOrder[] }>(
        await fetch("/api/admin/orders", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: order.id, status }),
        }),
      );
      const updated = result.orders.find((item) => item.id === order.id);
      if (updated) onUpdated({ ...order, ...updated });
      setMessage("Order status updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Permanently delete order ${order.number}? This cannot be undone.`)) return;
    setSaving(true);
    setMessage("");
    try {
      await readJson<{ orders: StoreOrder[] }>(
        await fetch(`/api/admin/orders?id=${encodeURIComponent(order.id)}`, { method: "DELETE" }),
      );
      onDeleted();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  async function saveTrackingNumber() {
    setSaving(true);
    setMessage("");
    try {
      const result = await readJson<{ orders: StoreOrder[] }>(
        await fetch("/api/admin/orders", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: order.id, postexTrackingNumber: trackingNumber }),
        }),
      );
      const updated = result.orders.find((item) => item.id === order.id);
      if (updated) onUpdated({ ...order, ...updated });
      setMessage(trackingNumber.trim() ? "PostEx tracking number saved." : "PostEx tracking number removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="order-detail-layout">
      <section className="order-detail-main">
        <div className="order-detail-title"><div><p className="eyebrow">ORDER NUMBER</p><h2>{order.number}</h2></div><i className={`record-status ${order.status}`}>{order.status}</i></div>
        <div className="order-detail-block"><h3>CUSTOMER & DELIVERY</h3><dl>
          <div><dt>Customer</dt><dd>{order.name}</dd></div><div><dt>Mobile</dt><dd>{order.phone}</dd></div><div><dt>City</dt><dd>{order.city}</dd></div><div><dt>Address</dt><dd>{order.address || "—"}</dd></div><div><dt>Postal code</dt><dd>{order.postal || "—"}</dd></div><div><dt>Customer note</dt><dd>{order.note || "—"}</dd></div>
        </dl></div>
        <div className="order-detail-block"><h3>ORDER ARTICLES</h3><div className="order-item-list">
          {(order.items || []).map((item) => <article key={item.id}><div><strong>{item.title}</strong><span>Size: {item.size} · Quantity: {item.quantity}</span></div><strong>{formatPkr(item.unitPricePkr * item.quantity)}</strong></article>)}
          {!order.items?.length ? <p>No order articles found.</p> : null}
        </div></div>
      </section>
      <aside className="order-detail-side">
        <h3>UPDATE ORDER</h3>
        <label>ORDER STATUS<select disabled={saving} value={order.status} onChange={(event) => change(event.target.value)}>
          <option value="received">Received</option><option value="confirmed">Confirmed</option><option value="packed">Packed</option><option value="dispatched">Dispatched</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option>
        </select></label>
        {(order.status === "dispatched" || order.status === "delivered") ? (
          <div className="order-postex-field">
            <label>POSTEX TRACKING NUMBER
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                maxLength={40}
                placeholder="Number from PostEx"
                disabled={saving}
                value={trackingNumber}
                onChange={(event) => setTrackingNumber(event.target.value.toUpperCase())}
              />
            </label>
            <p>Customers see this number and a PostEx tracking link after you save it.</p>
            <button
              className="primary-action"
              type="button"
              disabled={saving || trackingNumber.trim() === (order.postexTrackingNumber ?? "")}
              onClick={saveTrackingNumber}
            >{trackingNumber.trim() ? "SAVE TRACKING NUMBER" : "REMOVE TRACKING NUMBER"}</button>
          </div>
        ) : null}
        <dl>
          <div><dt>Subtotal</dt><dd>{formatPkr(order.subtotal || 0)}</dd></div>
          {order.discount ? <div><dt>Discount{order.offerCode ? ` · ${order.offerCode}` : ""}</dt><dd>− {formatPkr(order.discount)}</dd></div> : null}
          <div><dt>Delivery</dt><dd>{order.delivery === 0 ? "Free" : formatPkr(order.delivery || 0)}</dd></div>
          <div className="total"><dt>Total</dt><dd>{formatPkr(order.total)}</dd></div>
          <div><dt>Payment</dt><dd>{order.payment || "Cash on Delivery"}</dd></div>
        </dl>
        {order.status === "cancelled" ? (
          <button className="danger-action" disabled={saving} type="button" onClick={remove}>DELETE ORDER PERMANENTLY</button>
        ) : (
          <p className="order-delete-note">Cancel the order first to restore its reserved stock before permanent deletion.</p>
        )}
        <p className="editor-message" aria-live="polite">{message}</p>
      </aside>
    </div>
  );
}

export function CatalogManager({
  lastImportedAt,
  view,
  selectedId,
}: {
  lastImportedAt: string | null;
  view: "overview" | "articles" | "article-new" | "article-detail" | "import" | "import-detail" | "orders" | "order-detail";
  selectedId?: string;
}) {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [manualProducts, setManualProducts] = useState<ManualArticle[]>([]);
  const [approvedBrands, setApprovedBrands] = useState<ApprovedBrand[]>([]);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<StoreOrder | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [importMessage, setImportMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [lastSync, setLastSync] = useState(lastImportedAt);

  useEffect(() => {
    async function loadPageData() {
      try {
        setError("");
        setLoading(true);
        const needsImported = view === "overview" || view === "import" || view === "import-detail";
        const needsManual = view === "overview" || view === "articles" || view === "article-detail";
        const needsBrands = view === "article-new" || view === "article-detail";
        const needsOrders = view === "overview" || view === "orders";
        const needsOrderDetail = view === "order-detail" && Boolean(selectedId);
        if (needsOrderDetail) setSelectedOrder(null);

        const [imported, manual, brandResult, orderResult, orderDetailResult] = await Promise.all([
          needsImported
            ? fetch("/api/admin/catalog/imported").then((response) =>
                readJson<{ products: Article[] }>(response),
              )
            : Promise.resolve(null),
          needsManual
            ? fetch("/api/admin/articles").then((response) =>
                readJson<{ products: ManualArticle[] }>(response),
              )
            : Promise.resolve(null),
          needsBrands
            ? fetch("/api/admin/brands").then((response) =>
                readJson<{ brands: ApprovedBrand[] }>(response),
              )
            : Promise.resolve(null),
          needsOrders
            ? fetch("/api/admin/orders").then((response) =>
                readJson<{ orders: StoreOrder[] }>(response),
              )
            : Promise.resolve(null),
          needsOrderDetail
            ? fetch(`/api/admin/orders?id=${encodeURIComponent(selectedId || "")}`).then((response) =>
                readJson<{ order: StoreOrder }>(response),
              )
            : Promise.resolve(null),
        ]);

        if (imported) setArticles(imported.products);
        if (manual) setManualProducts(manual.products);
        if (brandResult) setApprovedBrands(brandResult.brands);
        if (orderResult) setOrders(orderResult.orders);
        if (orderDetailResult) setSelectedOrder(orderDetailResult.order);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        setLoading(false);
      }
    }

    loadPageData();
  }, [selectedId, view]);

  async function runImport() {
    setImporting(true);
    setImportMessage("");
    try {
      const result = await readJson<{
        products: Article[];
        sync: { discovered: number; inserted: number; updated: number; unchanged: number };
        importedAt: string;
      }>(
        await fetch("/api/admin/import/supplier", { method: "POST" }),
      );
      setArticles(result.products);
      setLastSync(result.importedAt);
      setImportMessage(
        `Import complete: ${result.sync.discovered} found, ${result.sync.inserted} new, ${result.sync.updated} updated.`,
      );
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setImporting(false);
    }
  }

  const publishedImported = articles.filter((article) => article.publishStatus === "published").length;
  const publishedManual = manualProducts.filter((article) => article.publishStatus === "published").length;
  const importedDrafts = articles.filter((article) => article.publishStatus !== "published").length;
  const openOrders = orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).length;
  const selectedManualArticle = manualProducts.find((article) => article.id === selectedId);
  const selectedImportedArticle = articles.find((article) => article.id === selectedId);
  const importTime = lastSync
    ? new Intl.DateTimeFormat("en-PK", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Karachi",
      }).format(new Date(lastSync))
    : "RUN MANUALLY";

  return (
    <>
      {error ? <p className="queue-error">{error}</p> : null}

      {view === "overview" ? (
        <>
          <section className="status-row overview-status" aria-label="Store status">
            <div><strong>{loading ? "—" : publishedManual + publishedImported}</strong><span>LIVE ARTICLES</span></div>
            <div><strong>{loading ? "—" : importedDrafts}</strong><span>IMPORTED DRAFTS TO REVIEW</span></div>
            <div><strong>{loading ? "—" : openOrders}</strong><span>OPEN CUSTOMER ORDERS</span></div>
            <div className="sync-time"><strong>{importTime}</strong><span>LAST SUPPLIER SYNC</span></div>
          </section>

          <section className="overview-actions" aria-label="Store Manager pages">
            <Link href="/articles">
              <span>01 · STOCK</span>
              <h2>ADD A NEW ARTICLE</h2>
              <p>Add HW Exclusive or Branded stock and control its price and publication.</p>
              <strong>MANAGE ARTICLES <b aria-hidden="true">→</b></strong>
            </Link>
            <Link href="/imports">
              <span>02 · BRANDED PRET</span>
              <h2>SUPPLIER IMPORT</h2>
              <p>Fetch new supplier articles, set your buying cost and publish selected stock.</p>
              <strong>OPEN IMPORT QUEUE <b aria-hidden="true">→</b></strong>
            </Link>
            <Link href="/orders">
              <span>03 · CASH ON DELIVERY</span>
              <h2>FULFIL ORDERS</h2>
              <p>Confirm, pack and dispatch customer orders from one clear queue.</p>
              <strong>VIEW {openOrders} OPEN ORDERS <b aria-hidden="true">→</b></strong>
            </Link>
            <Link href="/requests">
              <span>04 · CUSTOMER CARE</span>
              <h2>HANDLE REQUESTS</h2>
              <p>Review exchange, return and complaint forms received from customers.</p>
              <strong>OPEN CUSTOMER REQUESTS <b aria-hidden="true">→</b></strong>
            </Link>
          </section>
        </>
      ) : null}

      {view === "articles" ? (
        loading
          ? <p className="queue-loading">Loading your articles…</p>
          : <ManualArticlesList articles={manualProducts} />
      ) : null}

      {view === "article-new" ? (
        <section className="manager-detail-screen">
          <Link className="manager-back-link" href="/articles">← BACK TO ARTICLES</Link>
          <NewArticleForm
            approvedBrands={approvedBrands}
            onUpdated={setManualProducts}
            onCreated={() => router.push("/articles")}
          />
        </section>
      ) : null}

      {view === "article-detail" && loading ? <p className="queue-loading">Loading article details…</p> : null}
      {view === "article-detail" && !loading && selectedManualArticle ? (
        <section className="manager-detail-screen">
          <Link className="manager-back-link" href="/articles">← BACK TO ARTICLES</Link>
          <ManualArticleEditor
            article={selectedManualArticle}
            approvedBrands={approvedBrands}
            onUpdated={setManualProducts}
            onDeleted={() => router.push("/articles")}
          />
        </section>
      ) : null}
      {view === "article-detail" && !loading && !selectedManualArticle ? (
        <section className="manager-missing-record"><h2>Article not found</h2><p>It may have been deleted.</p><Link href="/articles">RETURN TO ARTICLES</Link></section>
      ) : null}

      {view === "import" ? (
        loading
          ? <p className="queue-loading">Loading imported articles…</p>
          : <ImportedArticlesList
              articles={articles}
              importing={importing}
              importMessage={importMessage}
              onImport={runImport}
            />
      ) : null}

      {view === "import-detail" && loading ? <p className="queue-loading">Loading imported article…</p> : null}
      {view === "import-detail" && !loading && selectedImportedArticle ? (
        <section className="manager-detail-screen imported-detail-screen">
          <Link className="manager-back-link" href="/imports">← BACK TO SUPPLIER ARTICLES</Link>
          <ArticleEditor
            article={selectedImportedArticle}
            onUpdated={setArticles}
            onRemoved={(products) => {
              setArticles(products);
              router.push("/imports");
            }}
          />
        </section>
      ) : null}
      {view === "import-detail" && !loading && !selectedImportedArticle ? (
        <section className="manager-missing-record"><h2>Imported article not found</h2><p>It may have been removed from the queue.</p><Link href="/imports">RETURN TO SUPPLIER ARTICLES</Link></section>
      ) : null}

      {view === "orders" && loading ? <p className="queue-loading">Loading customer orders…</p> : null}
      {view === "orders" && !loading ? <OrdersPanel orders={orders} /> : null}
      {view === "order-detail" && loading ? <p className="queue-loading">Loading order details…</p> : null}
      {view === "order-detail" && !loading && selectedOrder ? (
        <section className="manager-detail-screen">
          <Link className="manager-back-link" href="/orders">← BACK TO ORDERS</Link>
          <OrderDetailPanel
            order={selectedOrder}
            onUpdated={(order) => setSelectedOrder(order)}
            onDeleted={() => {
              setSelectedOrder(null);
              router.push("/orders");
            }}
          />
        </section>
      ) : null}
      {view === "order-detail" && !loading && !selectedOrder && !error ? (
        <section className="manager-missing-record"><h2>Order not found</h2><p>Check the order number and try again.</p><Link href="/orders">RETURN TO ORDERS</Link></section>
      ) : null}
    </>
  );
}
