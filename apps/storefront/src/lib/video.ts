export type VideoOrientation = "portrait" | "landscape";

export type VideoEmbed =
  | { kind: "file"; src: string; orientation: "landscape" }
  | { kind: "embed"; src: string; orientation: VideoOrientation };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function videoEmbed(value: string | null | undefined): VideoEmbed | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLocaleLowerCase("en").replace(/^(?:www\.|m\.)/, "");
  const segments = url.pathname.split("/").filter(Boolean);

  if (host === "youtube.com") {
    const watchId = url.searchParams.get("v") ?? "";
    if (segments[0] === "watch" && YOUTUBE_ID.test(watchId)) {
      return { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${watchId}`, orientation: "landscape" };
    }
    if (segments[0] === "shorts" && YOUTUBE_ID.test(segments[1] ?? "")) {
      return { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${segments[1]}`, orientation: "portrait" };
    }
    return null;
  }
  if (host === "youtu.be") {
    return YOUTUBE_ID.test(segments[0] ?? "")
      ? { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${segments[0]}`, orientation: "landscape" }
      : null;
  }
  if (host === "instagram.com") {
    if (/^(?:p|reel|reels)$/.test(segments[0] ?? "") && /^[A-Za-z0-9_-]+$/.test(segments[1] ?? "")) {
      const embedType = segments[0] === "p" ? "p" : "reel";
      return { kind: "embed", src: `https://www.instagram.com/${embedType}/${segments[1]}/embed`, orientation: "portrait" };
    }
    return null;
  }
  if (host === "tiktok.com") {
    return segments[1] === "video" && /^\d+$/.test(segments[2] ?? "")
      ? { kind: "embed", src: `https://www.tiktok.com/embed/v2/${segments[2]}`, orientation: "portrait" }
      : null;
  }
  if (/\.(?:mp4|webm)$/i.test(url.pathname)) {
    return { kind: "file", src: url.toString(), orientation: "landscape" };
  }
  return null;
}
