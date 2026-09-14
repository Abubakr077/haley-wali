import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { LoadingState } from "./LoadingState";

const REVIEW_IMAGE_SOURCE_LIMIT_BYTES = 8 * 1024 * 1024;
const REVIEW_IMAGE_TARGET_BYTES = 400 * 1024;
const REVIEW_IMAGE_UPLOAD_LIMIT_BYTES = 600 * 1024;
const REVIEW_IMAGE_MAX_DIMENSION = 1600;

type Review = {
  id: string;
  name: string;
  rating: number;
  title: string;
  comment: string;
  imageUrl?: string | null;
  createdAt: string;
};

type RatingDistribution = Record<1 | 2 | 3 | 4 | 5, number>;

const emptyDistribution: RatingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

function detectedImageType(bytes: Uint8Array): { contentType: string; extension: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { contentType: "image/jpeg", extension: "jpg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { contentType: "image/png", extension: "png" };
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return { contentType: "image/webp", extension: "webp" };
  }
  return null;
}

function canvasToWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("This browser could not prepare the review photo.")),
      "image/webp",
      quality,
    );
  });
}

async function optimizeReviewImage(file: File): Promise<File> {
  if (file.size > REVIEW_IMAGE_SOURCE_LIMIT_BYTES) throw new Error("Choose a photo smaller than 8 MB.");
  const bytes = await file.arrayBuffer();
  const type = detectedImageType(new Uint8Array(bytes.slice(0, 12)));
  if (!type) throw new Error("Choose a valid JPG, PNG or WebP photo.");
  const source = new File([bytes], file.name || `review-photo.${type.extension}`, { type: type.contentType });
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source);
  } catch {
    throw new Error("This photo could not be opened. Choose another JPG, PNG or WebP photo.");
  }
  try {
    let scale = Math.min(1, REVIEW_IMAGE_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    let best: Blob | null = null;
    for (let sizeAttempt = 0; sizeAttempt < 5; sizeAttempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser could not prepare the review photo.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.8, 0.7, 0.6, 0.5]) {
        best = await canvasToWebp(canvas, quality);
        if (best.size <= REVIEW_IMAGE_TARGET_BYTES) break;
      }
      if (best.size <= REVIEW_IMAGE_TARGET_BYTES) break;
      scale *= 0.82;
    }
    if (!best || best.size > REVIEW_IMAGE_UPLOAD_LIMIT_BYTES) {
      throw new Error("This photo could not be made small enough. Choose a simpler or smaller photo.");
    }
    return new File([best], "review-photo.webp", { type: "image/webp" });
  } finally {
    bitmap.close();
  }
}

export default function ProductReviews({ productId, apiBase }: { productId: string; apiBase: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [distribution, setDistribution] = useState<RatingDistribution>(emptyDistribution);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(5);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  useEffect(() => {
    if (!image) {
      setImagePreview("");
      return;
    }
    const preview = URL.createObjectURL(image);
    setImagePreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [image]);

  useEffect(() => {
    fetch(`${apiBase}/api/reviews?productId=${encodeURIComponent(productId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Reviews could not be loaded.");
        return response.json() as Promise<{ reviews?: Review[]; average?: number; count?: number; distribution?: RatingDistribution }>;
      })
      .then((result) => {
        setReviews(result.reviews ?? []);
        setAverage(Number(result.average ?? 0));
        setReviewCount(Number(result.count ?? result.reviews?.length ?? 0));
        setDistribution(result.distribution ?? emptyDistribution);
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, [apiBase, productId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      let optimizedImage: File | null = null;
      if (image) {
        setMessage("Preparing your photo…");
        optimizedImage = await optimizeReviewImage(image);
      }
      const body = new FormData();
      body.set("productId", productId);
      body.set("name", String(data.get("name") ?? ""));
      body.set("rating", String(rating));
      body.set("title", String(data.get("title") ?? ""));
      body.set("comment", String(data.get("comment") ?? ""));
      body.set("website", String(data.get("website") ?? ""));
      if (optimizedImage) body.set("image", optimizedImage);
      const response = await fetch(`${apiBase}/api/reviews`, {
        method: "POST",
        body,
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Review could not be submitted.");
      form.reset();
      setRating(5);
      setImage(null);
      setMessage("Thank you. Your review will appear after it is checked by Haley Wali.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Review could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="product-reviews" aria-labelledby="reviews-heading">
      <div className="reviews-heading">
        <div>
          <p className="eyebrow">CUSTOMER FEEDBACK</p>
          <h2 id="reviews-heading">RATINGS &amp; REVIEWS</h2>
        </div>
        <details className="review-compose">
          <summary>WRITE A REVIEW</summary>
          <form className="review-form" onSubmit={submit}>
            <p>Your review will be checked before it appears publicly.</p>
            <fieldset>
              <legend>YOUR RATING</legend>
              <div className="review-rating">
                {[1, 2, 3, 4, 5].map((value) => <button type="button" className={value <= rating ? "selected" : ""} onClick={() => setRating(value)} aria-label={`${value} star${value === 1 ? "" : "s"}`} aria-pressed={rating === value} key={value}>★</button>)}
              </div>
            </fieldset>
            <label>YOUR NAME<input name="name" required minLength={2} maxLength={60} autoComplete="name" /></label>
            <label>REVIEW TITLE <small>OPTIONAL</small><input name="title" maxLength={90} placeholder="For example: Beautiful fabric" /></label>
            <label>YOUR REVIEW<textarea name="comment" required minLength={10} maxLength={1000} rows={4} placeholder="Tell other customers about the fabric, fit and finishing." /></label>
            <label className="review-image-field">ADD A PHOTO <small>OPTIONAL</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event: ChangeEvent<HTMLInputElement>) => setImage(event.target.files?.[0] ?? null)} /><span>JPG, PNG or WebP up to 8 MB. We compress it before upload.</span></label>
            {imagePreview ? <div className="review-image-preview"><img src={imagePreview} alt="Selected review photo preview" /><button type="button" onClick={() => setImage(null)}>REMOVE PHOTO</button></div> : null}
            <label className="review-honeypot" aria-hidden="true">WEBSITE<input name="website" tabIndex={-1} autoComplete="off" /></label>
            <button className="primary-button" type="submit" disabled={submitting}>{submitting ? "SUBMITTING…" : "SUBMIT REVIEW"}</button>
            <p className="form-message" aria-live="polite">{message}</p>
          </form>
        </details>
      </div>

      <div className="review-overview">
        <div className="review-score" aria-label={reviewCount ? `${average} out of 5 from ${reviewCount} reviews` : "No reviews yet"}>
          <strong>{reviewCount ? average.toFixed(1) : "—"}</strong>
          <span aria-hidden="true">{reviewCount ? "★".repeat(Math.round(average)) + "☆".repeat(5 - Math.round(average)) : "☆☆☆☆☆"}</span>
          <small>Based on {reviewCount} {reviewCount === 1 ? "review" : "reviews"}</small>
        </div>
        <div className="review-breakdown" aria-label="Rating distribution">
          {([5, 4, 3, 2, 1] as const).map((value) => (
            <div key={value}>
              <span>{value} star</span>
              <span className="review-breakdown-track" aria-hidden="true"><i style={{ width: `${reviewCount ? (distribution[value] / reviewCount) * 100 : 0}%` }} /></span>
              <strong>{distribution[value]}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="reviews-list">
          <div className="reviews-list-heading"><h3>MOST RECENT REVIEWS</h3><span>{reviewCount} total</span></div>
          {loading ? <LoadingState compact label="Loading reviews" /> : null}
          {!loading && loadFailed ? <p className="review-empty">Reviews are temporarily unavailable.</p> : null}
          {!loading && !loadFailed && !reviews.length ? <p className="review-empty">No customer reviews yet. You can be the first to review this article.</p> : null}
          {reviews.map((review) => (
            <article className="review-card" key={review.id}>
              <header className="review-card-header">
                <div className="review-author">
                  <span aria-hidden="true">{review.name.trim().charAt(0).toUpperCase()}</span>
                  <div><strong>{review.name}</strong><small>Customer review</small></div>
                </div>
                <time dateTime={review.createdAt}>{new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" }).format(new Date(review.createdAt))}</time>
              </header>
              <span className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
              {review.title ? <h4>{review.title}</h4> : null}
              <p>{review.comment}</p>
              {review.imageUrl ? <img className="review-customer-image" src={review.imageUrl} alt="Photo shared with this review" loading="lazy" /> : null}
            </article>
          ))}
      </div>
    </section>
  );
}
