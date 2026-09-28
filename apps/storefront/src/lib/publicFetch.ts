/** Bound SSR waits without logging customer data or query parameters. */
export async function publicJson<T>(url: string, timeoutMs = 4000): Promise<T> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: "no-store", headers: { accept: "application/json" }, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json() as T;
  } catch (error) {
    console.warn(JSON.stringify({ event: "public_fetch_failed", path: new URL(url).pathname,
      durationMs: Date.now() - started, reason: controller.signal.aborted ? "timeout" : "request_failed" }));
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
