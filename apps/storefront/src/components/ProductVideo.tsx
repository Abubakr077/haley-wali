import type { Product } from "../lib/types";
import { videoEmbed } from "../lib/video";

export default function ProductVideo({ product }: { product: Product }) {
  const embed = videoEmbed(product.video);
  if (!embed) return null;

  return (
    <section className="product-video" aria-labelledby="product-video-heading">
      <div className="product-video-heading">
        <p className="eyebrow">WATCH THE ARTICLE</p>
        <h2 id="product-video-heading">ARTICLE VIDEO</h2>
      </div>
      <div className={`product-video-frame is-${embed.kind} is-${embed.orientation}`}>
        {embed.kind === "file" ? (
          <video
            src={embed.src}
            poster={product.image}
            controls
            playsInline
            preload="metadata"
            aria-label={`${product.name} video`}
          />
        ) : (
          <iframe
            src={embed.src}
            title={`${product.name} video`}
            loading="lazy"
            allow="encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
      </div>
    </section>
  );
}
