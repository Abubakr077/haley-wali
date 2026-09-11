import { fetchPublishedArticles } from "../lib/products";
import { SITE_ORIGIN, absoluteUrl } from "../lib/site";

export const prerender = false;

const staticPaths = [
  "/",
  "/shop",
  "/shop?category=exclusive",
  "/contact",
  "/info/about",
  "/info/delivery",
  "/info/exchange",
];

export async function GET() {
  const origin = SITE_ORIGIN;
  const apiBase = import.meta.env.PUBLIC_CATALOG_API_BASE ?? "http://127.0.0.1:3000";
  const articles = await fetchPublishedArticles(apiBase);
  const urls = [
    ...staticPaths.map((path) => absoluteUrl(path, origin)),
    ...articles.map((article) => absoluteUrl("/product", origin, `id=${encodeURIComponent(article.id)}`)),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((loc) => `  <url><loc>${loc}</loc></url>`).join("\n")}
</urlset>
`;
  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
