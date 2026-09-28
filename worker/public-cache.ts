/** Cache only anonymous public reads; writes and customer/admin data never enter here. */
export async function publicRead(
  request: Request,
  load: () => Promise<Response>,
  ctx: { waitUntil(promise: Promise<unknown>): void },
): Promise<Response> {
  const url = new URL(request.url);
  const eligible = request.method === "GET" && url.hostname === "manager.haleywali.pk"
    && ["/api/catalog/articles", "/api/catalog/pret", "/api/shop/settings", "/api/reviews"].includes(url.pathname)
    && !request.headers.has("authorization") && !request.headers.has("cookie")
    && !(request.headers.get("accept") || "").includes("text/html");
  const cache = eligible && typeof caches !== "undefined"
    ? (caches as CacheStorage & { default?: Cache }).default : undefined;
  // Separate CORS variants without storing cookies, customer identifiers or headers in the key.
  url.searchParams.set("__cors_origin", request.headers.get("origin") || "");
  const key = new Request(url, { method: "GET" });
  if (cache) {
    try {
      const hit = await cache.match(key);
      if (hit) {
        const response = new Response(hit.body, hit);
        response.headers.set("x-public-cache", "HIT");
        return response;
      }
    } catch { /* Cache availability must not prevent a public read. */ }
  }
  const started = Date.now();
  const response = await load();
  if (eligible) {
    response.headers.set("server-timing", `public-api;dur=${Date.now() - started}`);
    response.headers.set("x-public-cache", cache ? "MISS" : "BYPASS");
  }
  if (cache && response.status === 200 && !response.headers.has("set-cookie")) {
    ctx.waitUntil(cache.put(key, response.clone()).catch(() => {
      console.warn(JSON.stringify({ event: "public_cache_write_failed", path: url.pathname }));
    }));
  }
  return response;
}
