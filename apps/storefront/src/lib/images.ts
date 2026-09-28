import manifest from "./image-manifest.json";

type Variant = { src: string; width: number; height: number };
const images = manifest as Record<string, Variant[]>;
export const CARD_SIZES = "(max-width: 600px) 50vw, (max-width: 1000px) 33vw, 25vw";
export const DETAIL_SIZES = "(max-width: 760px) 100vw, 55vw";

export function responsiveImage(source: string, sizes: string) {
  const variants = images[source];
  if (!variants?.length) return { src: source };
  const fallback = variants.find(image => image.width >= 640) ?? variants[variants.length - 1];
  return {
    src: fallback.src,
    srcSet: variants.map(image => `${image.src} ${image.width}w`).join(", "),
    sizes,
    width: fallback.width,
    height: fallback.height,
  };
}

export function responsiveImageAttributes(source: string, sizes: string) {
  const { srcSet, ...attributes } = responsiveImage(source, sizes);
  return { ...attributes, srcset: srcSet };
}
