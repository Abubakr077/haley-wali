export const SITE_ORIGIN = "https://haleywali.pk";
export const DEFAULT_SHARE_IMAGE_PATH = "/brand/og-share.png";
export const DEFAULT_SHARE_IMAGE_WIDTH = 1200;
export const DEFAULT_SHARE_IMAGE_HEIGHT = 630;
export const DEFAULT_SHARE_IMAGE_ALT = "Haley Wali clothing for Pakistan";

export function absoluteUrl(path = "/", origin = SITE_ORIGIN, search = "") {
  const url = new URL(path || "/", origin);
  if (search) url.search = search.startsWith("?") ? search.slice(1) : search;
  return url.href;
}

export function shareImageUrl(src: string | null | undefined, origin = SITE_ORIGIN) {
  if (!src || /\.svg(?:$|\?)/i.test(src)) {
    return absoluteUrl(DEFAULT_SHARE_IMAGE_PATH, origin);
  }
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("/")) return absoluteUrl(src, origin);
  return absoluteUrl(DEFAULT_SHARE_IMAGE_PATH, origin);
}

export function isDefaultShareImage(src: string) {
  return src.includes(DEFAULT_SHARE_IMAGE_PATH);
}
