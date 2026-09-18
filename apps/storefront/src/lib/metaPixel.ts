type MetaPixelParameters = Record<string, string | number | boolean | string[] | number[] | undefined>;

declare global {
  interface Window {
    fbq?: (method: "track", eventName: string, parameters?: MetaPixelParameters) => void;
  }
}

export function trackMetaEvent(eventName: string, parameters: MetaPixelParameters = {}) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq("track", eventName, parameters);
}

export function pkrValue(value: number) {
  return Math.max(0, Math.round(value));
}
