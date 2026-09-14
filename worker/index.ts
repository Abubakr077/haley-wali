/** Cloudflare Worker entry point for the vinext-starter template. */
import handler from "vinext/server/app-router-entry";
import {
  D1CatalogRepository,
  type D1DatabaseLike,
} from "../modules/catalog-import/repository.ts";
import {
  CHAUDHARY_ARTS_SOURCE,
  runSupplierSync,
} from "../modules/catalog-import/sync.ts";

type D1QueryResult = {
  results?: Record<string, unknown>[];
};

type CatalogDatabase = D1DatabaseLike & {
  prepare(query: string): ReturnType<D1DatabaseLike["prepare"]> & {
    all(): Promise<D1QueryResult>;
  };
  batch(statements: Array<ReturnType<D1DatabaseLike["prepare"]>>): Promise<unknown[]>;
};

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB: CatalogDatabase;
  AI?: {
    run(model: string, input: Record<string, unknown>): Promise<unknown>;
  };
  ADMIN_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
  PUBLIC_STOREFRONT_ORIGIN?: string;
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_STORAGE_BUCKET?: string;
}

const APPROVED_ARTICLE_BRANDS = [
  { name: "Other Brands", aliases: ["Other Brand"] },
  { name: "Alkaram Studio", aliases: ["Alkaram", "Al Karam"] },
  { name: "Asim Jofa", aliases: [] },
  { name: "Baroque", aliases: [] },
  { name: "Beechtree", aliases: ["Beech Tree"] },
  { name: "Bonanza Satrangi", aliases: ["Bonanza", "Satrangi"] },
  { name: "Cross Stitch", aliases: ["CrossStitch"] },
  { name: "Ethnic", aliases: ["Ethnc"] },
  { name: "Generation", aliases: [] },
  { name: "Gul Ahmed", aliases: ["GulAhmed"] },
  { name: "J.", aliases: ["Junaid Jamshed", "J Dot"] },
  { name: "Khaadi", aliases: ["Khadi"] },
  { name: "Limelight", aliases: ["Lime Light"] },
  { name: "Maria.B", aliases: ["Maria B", "Maria B."] },
  { name: "Nishat Linen", aliases: ["Nishat"] },
  { name: "Outfitters", aliases: ["Outfitter"] },
  { name: "Rang Rasiya", aliases: [] },
  { name: "Sana Safinaz", aliases: [] },
  { name: "Sapphire", aliases: ["Saphire"] },
  { name: "Saya", aliases: [] },
  { name: "So Kamal", aliases: ["Sokamal"] },
  { name: "Zellbury", aliases: ["Zell Bury"] },
] as const;

function normalizedBrandKey(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en");
}

function approvedArticleBrand(value: unknown) {
  const key = normalizedBrandKey(value);
  return APPROVED_ARTICLE_BRANDS.find((brand) =>
    normalizedBrandKey(brand.name) === key
    || brand.aliases.some((alias) => normalizedBrandKey(alias) === key),
  );
}

const brandSuggestionCache = new Map<string, string[]>();

function aiText(result: unknown): string {
  const response = result as {
    response?: unknown;
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = response.response ?? response.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const item = part as { text?: unknown; content?: unknown };
          return String(item.text ?? item.content ?? "");
        }
        return "";
      })
      .join("\n");
  }
  return "";
}

function cleanSuggestedBrand(value: string): string {
  return value
    .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
    .replace(/^['"`]|['"`]$/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

async function suggestApprovedBrands(env: Env, value: unknown): Promise<string[]> {
  const query = String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");
  if (query.length < 2 || query.length > 50) {
    throw new Error("Enter a complete brand name between 2 and 50 characters.");
  }
  const exact = approvedArticleBrand(query);
  if (exact) return [exact.name];
  const cacheKey = normalizedBrandKey(query);
  const cached = brandSuggestionCache.get(cacheKey);
  if (cached) return cached;
  if (!env.AI) throw new Error("AI brand suggestions are not configured.");

  const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fast", {
    messages: [
      {
        role: "system",
        content: "Normalize a possibly misspelled fashion brand sold in Pakistan. Return at most three likely official brand names, one per line, with exact capitalization. Suggest only real established clothing or fashion brands. If the text is not recognizably a real brand, return NONE. Never add commentary.",
      },
      {
        role: "user",
        content: `Typed brand name: ${query}`,
      },
    ],
    max_completion_tokens: 60,
    temperature: 0,
  });
  const suggestions = aiText(result)
    .split(/\r?\n|,/)
    .map(cleanSuggestedBrand)
    .filter((name) => name && normalizedBrandKey(name) !== "none")
    .filter((name) => name.length >= 2 && name.length <= 50)
    .filter((name) => /^[\p{L}\p{N}&.'’+\- ]+$/u.test(name))
    .filter((name, index, names) => names.findIndex((item) => normalizedBrandKey(item) === normalizedBrandKey(name)) === index)
    .slice(0, 3);
  brandSuggestionCache.set(cacheKey, suggestions);
  if (brandSuggestionCache.size > 100) {
    const oldest = brandSuggestionCache.keys().next().value;
    if (oldest) brandSuggestionCache.delete(oldest);
  }
  return suggestions;
}

async function getApprovedArticleBrands(db: CatalogDatabase) {
  const result = await db.prepare(
    `SELECT canonical_name AS name FROM approved_article_brands
     UNION
     SELECT DISTINCT brand AS name FROM manual_products WHERE collection = 'branded'
     ORDER BY name COLLATE NOCASE`,
  ).all();
  const brands = new Map<string, { name: string; aliases: string[] }>();
  for (const brand of APPROVED_ARTICLE_BRANDS) {
    brands.set(normalizedBrandKey(brand.name), { name: brand.name, aliases: [...brand.aliases] });
  }
  for (const row of result.results ?? []) {
    const name = String(row.name ?? "").trim();
    if (name && !brands.has(normalizedBrandKey(name))) {
      brands.set(normalizedBrandKey(name), { name, aliases: [] });
    }
  }
  return [...brands.values()].sort((a, b) => a.name.localeCompare(b.name, "en"));
}

async function canonicalApprovedArticleBrand(db: CatalogDatabase, value: unknown): Promise<string | null> {
  const builtIn = approvedArticleBrand(value);
  if (builtIn) return builtIn.name;
  const name = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!name) return null;
  const row = await db.prepare(
    `SELECT name FROM (
       SELECT canonical_name AS name FROM approved_article_brands
       UNION
       SELECT DISTINCT brand AS name FROM manual_products WHERE collection = 'branded'
     ) WHERE lower(name) = lower(?) LIMIT 1`,
  ).bind(name).first() as { name?: string } | null;
  return row?.name ? String(row.name) : null;
}

async function approveSuggestedBrand(db: CatalogDatabase, value: unknown): Promise<string> {
  const name = cleanSuggestedBrand(String(value ?? ""));
  if (name.length < 2 || name.length > 50 || !/^[\p{L}\p{N}&.'’+\- ]+$/u.test(name)) {
    throw new Error("Select a valid AI brand suggestion.");
  }
  const builtIn = approvedArticleBrand(name);
  const canonicalName = builtIn?.name ?? name;
  await db.prepare(
    `INSERT OR IGNORE INTO approved_article_brands (canonical_name, source, created_at)
     VALUES (?, 'ai_confirmed', ?)`,
  ).bind(canonicalName, new Date().toISOString()).run();
  return canonicalName;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

function jsonResponse(
  value: unknown,
  init: ResponseInit = {},
): Response {
  return Response.json(value, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
    },
  });
}

function publicCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin) return {};
  const allowed = new Set([
    ...(env.PUBLIC_STOREFRONT_ORIGIN ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    "http://localhost:4321",
    "http://127.0.0.1:4321",
  ]);
  return allowed.has(origin)
    ? {
        "access-control-allow-origin": origin,
        "access-control-allow-headers": "content-type, idempotency-key",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        vary: "Origin",
      }
    : {};
}

const MAX_ARTICLE_IMAGE_BYTES = 1200 * 1024;
const MAX_ARTICLE_UPLOAD_BYTES = MAX_ARTICLE_IMAGE_BYTES * 8;
const MAX_ARTICLE_IMAGE_COUNT = 8;
const MAX_REVIEW_IMAGE_BYTES = 600 * 1024;
const MAX_REVIEW_SUBMISSION_BYTES = MAX_REVIEW_IMAGE_BYTES + 64 * 1024;
const ARTICLE_IMAGE_TYPES = new Map([
  ["image/jpeg", { extension: "jpg", signature: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff }],
  ["image/png", { extension: "png", signature: (bytes: Uint8Array) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 }],
  ["image/webp", { extension: "webp", signature: (bytes: Uint8Array) => bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 }],
]);

function detectedArticleImageType(bytes: Uint8Array) {
  for (const [contentType, format] of ARTICLE_IMAGE_TYPES) {
    if (format.signature(bytes)) return { contentType, ...format };
  }
  return null;
}

function supabaseStorageConfig(env: Env) {
  const configuredUrl = String(env.SUPABASE_URL ?? "").trim();
  let url = "";
  try {
    const parsedUrl = new URL(configuredUrl);
    if (parsedUrl.protocol === "https:" && /^[a-z0-9-]+\.supabase\.co$/i.test(parsedUrl.hostname)) {
      url = parsedUrl.origin;
    }
  } catch {
    // Invalid or missing project URL is handled by the null configuration below.
  }
  const secretKey = String(env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const bucket = String(env.SUPABASE_STORAGE_BUCKET ?? "haley-wali-articles").trim();
  const validBucket = bucket.length > 0 && bucket.length <= 100 && ![/[\/\\?#]/, /[\u0000-\u001f\u007f]/].some((pattern) => pattern.test(bucket));
  if (!url || !secretKey || !validBucket) return null;
  return { url, secretKey, bucket };
}

function supabaseStorageHeaders(secretKey: string): Record<string, string> {
  const headers: Record<string, string> = { apikey: secretKey };
  // Legacy service_role keys are JWTs. Modern sb_secret_ keys authenticate
  // through the apikey header and must not be used as bearer JWTs.
  if (secretKey.startsWith("eyJ")) headers.authorization = `Bearer ${secretKey}`;
  return headers;
}

function storagePath(value: string): string {
  return value.split("/").map(encodeURIComponent).join("/");
}

function supabasePublicImageUrl(config: NonNullable<ReturnType<typeof supabaseStorageConfig>>, key: string) {
  return `${config.url}/storage/v1/object/public/${encodeURIComponent(config.bucket)}/${storagePath(key)}`;
}

async function uploadSupabaseImage(
  config: NonNullable<ReturnType<typeof supabaseStorageConfig>>,
  key: string,
  file: File,
  contentType: string,
) {
  const response = await fetch(
    `${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}/${storagePath(key)}`,
    {
      method: "POST",
      headers: {
        ...supabaseStorageHeaders(config.secretKey),
        // File names and browser-reported MIME types are not reliable. This is
        // the type detected from the image signature before the upload.
        "content-type": contentType,
        "cache-control": "max-age=31536000",
        "x-upsert": "false",
      },
      body: file,
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase image upload failed (${response.status}): ${detail.slice(0, 180)}`);
  }
}

async function deleteSupabaseImages(
  config: NonNullable<ReturnType<typeof supabaseStorageConfig>>,
  keys: string[],
) {
  if (!keys.length) return;
  const response = await fetch(
    `${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}`,
    {
      method: "DELETE",
      headers: {
        ...supabaseStorageHeaders(config.secretKey),
        "content-type": "application/json",
      },
      body: JSON.stringify({ prefixes: keys }),
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase image cleanup failed (${response.status}): ${detail.slice(0, 180)}`);
  }
}

async function uploadArticleImages(request: Request, env: Env): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_ARTICLE_UPLOAD_BYTES + 1024 * 1024) {
    return jsonResponse({ error: "The selected images are too large. Upload no more than 8 optimized images at once." }, { status: 413 });
  }
  const data = await request.formData();
  const files = data.getAll("images").filter((value): value is File => value instanceof File);
  if (!files.length) {
    return jsonResponse({ error: "Choose at least one JPG, PNG or WebP image." }, { status: 400 });
  }
  if (files.length > MAX_ARTICLE_IMAGE_COUNT) {
    return jsonResponse({ error: `Upload no more than ${MAX_ARTICLE_IMAGE_COUNT} images at once.` }, { status: 400 });
  }
  if (files.reduce((total, file) => total + file.size, 0) > MAX_ARTICLE_UPLOAD_BYTES) {
    return jsonResponse({ error: "The selected images are too large. Upload no more than 8 optimized images at once." }, { status: 413 });
  }

  const validated: Array<{ file: File; contentType: string; extension: string }> = [];
  for (const file of files) {
    if (file.size < 12 || file.size > MAX_ARTICLE_IMAGE_BYTES) {
      return jsonResponse({ error: `${file.name || "An image"} must be smaller than 1.2 MB after optimization.` }, { status: 400 });
    }
    const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const format = detectedArticleImageType(signature);
    if (!format) {
      return jsonResponse({ error: `${file.name || "An image"} must contain valid JPG, PNG or WebP image data.` }, { status: 400 });
    }
    validated.push({ file, contentType: format.contentType, extension: format.extension });
  }

  const uploaded: Array<{ url: string; key: string; size: number }> = [];
  const supabase = supabaseStorageConfig(env);
  if (!supabase) {
    return jsonResponse({ error: "Supabase image storage is not configured for the Store Manager." }, { status: 503 });
  }
  try {
    for (const { file, contentType, extension } of validated) {
      const date = new Date();
      const key = `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${extension}`;
      await uploadSupabaseImage(supabase, key, file, contentType);
      uploaded.push({ key, size: file.size, url: supabasePublicImageUrl(supabase, key) });
    }
  } catch (error) {
    if (uploaded.length) {
      await deleteSupabaseImages(supabase, uploaded.map((image) => image.key));
    }
    throw error;
  }
  return jsonResponse({ images: uploaded }, { status: 201 });
}

function storedSupabaseImageKey(value: unknown, env: Env): string | null {
  const config = supabaseStorageConfig(env);
  if (!config) return null;
  try {
    const url = new URL(String(value ?? ""));
    const prefix = `/storage/v1/object/public/${encodeURIComponent(config.bucket)}/`;
    if (url.origin !== new URL(config.url).origin || !url.pathname.startsWith(prefix)) return null;
    const key = url.pathname.slice(prefix.length).split("/").map(decodeURIComponent).join("/");
    return /^(?:reviews\/)?\d{4}\/\d{2}\/[0-9a-f-]+\.(?:jpg|png|webp)$/.test(key) ? key : null;
  } catch {
    return null;
  }
}

async function deleteUnreferencedArticleImages(
  db: CatalogDatabase,
  env: Env,
  urls: unknown[],
): Promise<void> {
  const supabaseKeys: string[] = [];
  for (const value of [...new Set(urls.map((url) => String(url ?? "").trim()).filter(Boolean))]) {
    const supabaseKey = storedSupabaseImageKey(value, env);
    if (!supabaseKey) continue;
    const referenced = await db.prepare(
      `SELECT id FROM manual_products
       WHERE image_url = ? OR instr(gallery_json, ?) > 0
       UNION ALL
       SELECT id FROM product_reviews WHERE image_url = ?
       LIMIT 1`,
    ).bind(value, value, value).first();
    if (!referenced && supabaseKey) supabaseKeys.push(supabaseKey);
  }
  const supabase = supabaseStorageConfig(env);
  if (supabase && supabaseKeys.length) await deleteSupabaseImages(supabase, supabaseKeys);
}

const SESSION_COOKIE = "haley_wali_admin";

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signSession(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

function hexToBytes(value: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null;
  return new Uint8Array(value.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
}

async function verifyHmac(value: string, signature: string, secret: string): Promise<boolean> {
  const bytes = hexToBytes(signature);
  if (!bytes) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(value));
}

async function verifyPassword(provided: string, expected: string): Promise<boolean> {
  const challenge = new TextEncoder().encode("haley-wali-admin-password");
  const suppliedKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(provided),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expectedKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(expected),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const suppliedSignature = await crypto.subtle.sign("HMAC", suppliedKey, challenge);
  return crypto.subtle.verify("HMAC", expectedKey, suppliedSignature, challenge);
}

function publicReference(prefix: "HW" | "HWR"): string {
  const random = crypto.getRandomValues(new Uint8Array(5));
  return `${prefix}-${[...random].map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

async function validAdminSession(request: Request, env: Env): Promise<boolean> {
  if (!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) return false;
  const cookies = request.headers.get("cookie") ?? "";
  const token = cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  if (!token) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  return verifyHmac(expires, signature, env.ADMIN_SESSION_SECRET);
}

function adminCookie(value: string, maxAge: number, request: Request): string {
  const hostname = new URL(request.url).hostname;
  const secure = hostname === "localhost" || hostname === "127.0.0.1" ? "" : "; Secure";
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=${maxAge}`;
}

function isSameOriginWrite(request: Request): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  return origin === new URL(request.url).origin && (!fetchSite || fetchSite === "same-origin");
}

function isAllowedManagerHostname(hostname: string): boolean {
  return hostname === "manager.haleywali.pk" || hostname === "localhost" || hostname === "127.0.0.1";
}

function withManagerSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  const securityHeaders: Record<string, string> = {
    "cache-control": "no-store, max-age=0",
    "content-security-policy": [
      "default-src 'self'",
      "base-uri 'self'",
      "connect-src 'self'",
      "font-src 'self' data:",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data: blob: https:",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "upgrade-insecure-requests",
    ].join("; "),
    "cross-origin-opener-policy": "same-origin",
    "permissions-policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    pragma: "no-cache",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "x-robots-tag": "noindex, nofollow, noarchive",
  };
  for (const [name, value] of Object.entries(securityHeaders)) headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function ensureCatalogSchema(db: CatalogDatabase): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS suppliers (
       id text PRIMARY KEY NOT NULL,
       name text NOT NULL,
       base_url text NOT NULL,
       collection_handle text NOT NULL,
       active integer DEFAULT true NOT NULL,
       last_synced_at text
     )`,
    `CREATE TABLE IF NOT EXISTS supplier_products (
       id text PRIMARY KEY NOT NULL,
       supplier_id text NOT NULL REFERENCES suppliers(id),
       external_id text NOT NULL,
       handle text NOT NULL,
       title text NOT NULL,
       description_html text DEFAULT '' NOT NULL,
       source_url text NOT NULL,
       source_price_pkr integer NOT NULL,
       compare_at_price_pkr integer,
       image_url text,
       gallery_json text DEFAULT '[]' NOT NULL,
       variants_json text DEFAULT '[]' NOT NULL,
       source_available integer DEFAULT true NOT NULL,
       source_updated_at text,
       content_hash text NOT NULL,
       first_seen_at text NOT NULL,
       last_seen_at text NOT NULL
     )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS supplier_products_supplier_external_uidx
       ON supplier_products (supplier_id, external_id)`,
    `CREATE INDEX IF NOT EXISTS supplier_products_last_seen_idx
       ON supplier_products (supplier_id, last_seen_at)`,
    `CREATE TABLE IF NOT EXISTS catalog_products (
       id text PRIMARY KEY NOT NULL,
       supplier_product_id text NOT NULL REFERENCES supplier_products(id),
       category text DEFAULT 'pret' NOT NULL,
       public_title text NOT NULL,
       cost_price_pkr integer,
       selling_price_pkr integer,
       overhead_pkr integer DEFAULT 250 NOT NULL,
       target_margin_bps integer DEFAULT 2500 NOT NULL,
       pricing_status text DEFAULT 'awaiting_cost' NOT NULL,
       publish_status text DEFAULT 'draft' NOT NULL,
       supply_mode text DEFAULT 'on_demand' NOT NULL,
       stock_qty integer DEFAULT 0 NOT NULL,
       created_at text NOT NULL,
       updated_at text NOT NULL
     )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS catalog_products_supplier_product_uidx
       ON catalog_products (supplier_product_id)`,
    `CREATE INDEX IF NOT EXISTS catalog_products_public_idx
       ON catalog_products (category, publish_status, selling_price_pkr)`,
    `CREATE TABLE IF NOT EXISTS import_runs (
       id text PRIMARY KEY NOT NULL,
       supplier_id text NOT NULL REFERENCES suppliers(id),
       started_at text NOT NULL,
       finished_at text,
       status text NOT NULL,
       discovered_count integer DEFAULT 0 NOT NULL,
       inserted_count integer DEFAULT 0 NOT NULL,
       updated_count integer DEFAULT 0 NOT NULL,
       unchanged_count integer DEFAULT 0 NOT NULL,
       error_message text
     )`,
    `CREATE TABLE IF NOT EXISTS manual_products (
       id text PRIMARY KEY NOT NULL,
       collection text DEFAULT 'exclusive' NOT NULL,
       garment_type text DEFAULT 'unstitched' NOT NULL,
       brand text DEFAULT 'Haley Wali' NOT NULL,
       public_title text NOT NULL,
       article_code text DEFAULT '' NOT NULL,
       subtitle text DEFAULT 'Clothing Article' NOT NULL,
       description text DEFAULT '' NOT NULL,
       image_url text,
       gallery_json text DEFAULT '[]' NOT NULL,
       variants_json text DEFAULT '[]' NOT NULL,
       pieces text DEFAULT '1 Piece' NOT NULL,
       season text DEFAULT 'All Season' NOT NULL,
       fabric text DEFAULT 'See article details' NOT NULL,
       color text DEFAULT 'As shown' NOT NULL,
       care text DEFAULT 'Follow the care label' NOT NULL,
       shirt_details text DEFAULT '' NOT NULL,
       trouser_details text DEFAULT '' NOT NULL,
       dupatta_details text DEFAULT '' NOT NULL,
       model_details text DEFAULT '' NOT NULL,
       measurements_json text DEFAULT '[]' NOT NULL,
       includes_json text DEFAULT '[]' NOT NULL,
       cost_price_pkr integer,
       selling_price_pkr integer,
       publish_status text DEFAULT 'draft' NOT NULL,
       stock_qty integer DEFAULT 0 NOT NULL,
       created_at text NOT NULL,
       updated_at text NOT NULL
     )`,
    `CREATE INDEX IF NOT EXISTS manual_products_public_idx
       ON manual_products (collection, publish_status, selling_price_pkr)`,
    `CREATE TABLE IF NOT EXISTS approved_article_brands (
       canonical_name text PRIMARY KEY COLLATE NOCASE NOT NULL,
       source text DEFAULT 'ai_confirmed' NOT NULL,
       created_at text NOT NULL
     )`,
    `CREATE TABLE IF NOT EXISTS manual_variant_stock (
       product_id text NOT NULL REFERENCES manual_products(id) ON DELETE CASCADE,
       size text NOT NULL,
       stock_qty integer DEFAULT 0 NOT NULL
     )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS manual_variant_stock_product_size_uidx
       ON manual_variant_stock (product_id, size)`,
    `CREATE TABLE IF NOT EXISTS orders (
       id text PRIMARY KEY NOT NULL,
       order_number text UNIQUE NOT NULL,
       customer_name text NOT NULL,
       phone text NOT NULL,
       address text NOT NULL,
       city text NOT NULL,
       postal_code text,
       note text,
       subtotal_pkr integer NOT NULL,
       delivery_pkr integer NOT NULL,
       total_pkr integer NOT NULL,
       payment_method text DEFAULT 'Cash on Delivery' NOT NULL,
       status text DEFAULT 'received' NOT NULL,
       whatsapp_status text DEFAULT 'not_configured' NOT NULL,
       checkout_token text UNIQUE,
       stock_restored integer DEFAULT 0 NOT NULL,
       created_at text NOT NULL,
       updated_at text NOT NULL
     )`,
    `CREATE INDEX IF NOT EXISTS orders_lookup_idx
       ON orders (order_number, phone)`,
    `CREATE TABLE IF NOT EXISTS order_items (
       id text PRIMARY KEY NOT NULL,
       order_id text NOT NULL REFERENCES orders(id),
       product_id text NOT NULL,
       title text NOT NULL,
       size text NOT NULL,
       quantity integer NOT NULL,
       unit_price_pkr integer NOT NULL
     )`,
    `CREATE TABLE IF NOT EXISTS customer_requests (
       id text PRIMARY KEY NOT NULL,
       request_number text UNIQUE NOT NULL,
       type text NOT NULL,
       order_number text,
       customer_name text NOT NULL,
       phone text NOT NULL,
       email text,
       article_name text,
       reason text NOT NULL,
       details text NOT NULL,
       status text DEFAULT 'received' NOT NULL,
       whatsapp_status text DEFAULT 'not_configured' NOT NULL,
       created_at text NOT NULL,
       updated_at text NOT NULL
     )`,
    `CREATE INDEX IF NOT EXISTS customer_requests_status_idx
       ON customer_requests (status, created_at)`,
    `CREATE TABLE IF NOT EXISTS admin_login_attempts (
       ip_hash text PRIMARY KEY NOT NULL,
       window_started_at integer NOT NULL,
       failed_count integer DEFAULT 0 NOT NULL,
       blocked_until integer DEFAULT 0 NOT NULL
     )`,
    `CREATE TABLE IF NOT EXISTS product_reviews (
       id text PRIMARY KEY NOT NULL,
       product_id text NOT NULL,
       customer_name text NOT NULL,
       rating integer NOT NULL,
       title text DEFAULT '' NOT NULL,
       comment text NOT NULL,
       image_url text,
       status text DEFAULT 'pending' NOT NULL,
       submitter_hash text NOT NULL,
       created_at text NOT NULL,
       updated_at text NOT NULL
     )`,
    `CREATE INDEX IF NOT EXISTS product_reviews_public_idx
       ON product_reviews (product_id, status, created_at)`,
    `CREATE INDEX IF NOT EXISTS product_reviews_submitter_idx
       ON product_reviews (submitter_hash, created_at)`,
    `CREATE TABLE IF NOT EXISTS store_settings (
       id text PRIMARY KEY NOT NULL,
       delivery_pkr integer DEFAULT 250 NOT NULL,
       sale_active integer DEFAULT 1 NOT NULL,
       sale_percent integer DEFAULT 10 NOT NULL,
       sale_name text DEFAULT 'Season End Sale' NOT NULL,
       sale_description text DEFAULT 'The reduced price is already shown across HW Exclusive and Branded articles. No sale code is needed.' NOT NULL,
       updated_at text NOT NULL
     )`,
    `CREATE TABLE IF NOT EXISTS offer_codes (
       id text PRIMARY KEY NOT NULL,
       code text NOT NULL,
       name text NOT NULL,
       status text DEFAULT 'active' NOT NULL,
       discount_type text DEFAULT 'percent' NOT NULL,
       discount_value integer DEFAULT 0 NOT NULL,
       free_delivery integer DEFAULT 0 NOT NULL,
       applies_to text DEFAULT 'all' NOT NULL,
       min_subtotal_pkr integer,
       max_redemptions integer,
       redemption_count integer DEFAULT 0 NOT NULL,
       per_phone integer DEFAULT 0 NOT NULL,
       starts_at text,
       ends_at text,
       created_at text NOT NULL,
       updated_at text NOT NULL
     )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS offer_codes_code_uidx ON offer_codes (code)`,
    `CREATE TABLE IF NOT EXISTS offer_redemptions (
       id text PRIMARY KEY NOT NULL,
       offer_id text NOT NULL REFERENCES offer_codes(id),
       order_id text NOT NULL REFERENCES orders(id),
       phone text NOT NULL,
       amount_saved_pkr integer NOT NULL,
       per_phone_lock integer DEFAULT 0 NOT NULL,
       created_at text NOT NULL
     )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS offer_redemptions_offer_order_uidx
       ON offer_redemptions (offer_id, order_id)`,
    `CREATE INDEX IF NOT EXISTS offer_redemptions_phone_idx
       ON offer_redemptions (offer_id, phone)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS offer_redemptions_per_phone_uidx
       ON offer_redemptions (offer_id, phone)
       WHERE per_phone_lock = 1`,
  ];
  for (const statement of statements) {
    await db.prepare(statement).run();
  }
  const ensureColumns = async (table: string, columns: Array<[string, string]>) => {
    const info = await db.prepare(`PRAGMA table_info(${table})`).all();
    const existing = new Set((info.results ?? []).map((row) => String(row.name)));
    for (const [name, definition] of columns) {
      if (!existing.has(name)) await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`).run();
    }
  };
  await ensureColumns("manual_products", [
    ["article_code", "text DEFAULT '' NOT NULL"],
    ["season", "text DEFAULT 'All Season' NOT NULL"],
    ["shirt_details", "text DEFAULT '' NOT NULL"],
    ["trouser_details", "text DEFAULT '' NOT NULL"],
    ["dupatta_details", "text DEFAULT '' NOT NULL"],
    ["model_details", "text DEFAULT '' NOT NULL"],
    ["measurements_json", "text DEFAULT '[]' NOT NULL"],
  ]);
  await ensureColumns("orders", [
    ["checkout_token", "text"],
    ["stock_restored", "integer DEFAULT 0 NOT NULL"],
    ["discount_pkr", "integer DEFAULT 0 NOT NULL"],
    ["offer_code", "text"],
  ]);
  await ensureColumns("store_settings", [
    ["sale_active", "integer DEFAULT 1 NOT NULL"],
    ["sale_percent", "integer DEFAULT 10 NOT NULL"],
    ["sale_name", "text DEFAULT 'Season End Sale' NOT NULL"],
    ["sale_description", "text DEFAULT 'The reduced price is already shown across HW Exclusive and Branded articles. No sale code is needed.' NOT NULL"],
  ]);
  await ensureColumns("product_reviews", [
    ["image_url", "text"],
  ]);
  await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_token_uidx ON orders (checkout_token)").run();
  await db.prepare(
    `INSERT OR IGNORE INTO store_settings (id, delivery_pkr, updated_at)
     VALUES ('default', 250, ?)`,
  ).bind(new Date().toISOString()).run();
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;

async function loginClientHash(request: Request): Promise<string> {
  const address = request.headers.get("CF-Connecting-IP") ?? "local";
  return bytesToHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(address)));
}

async function loginAllowed(db: CatalogDatabase, ipHash: string): Promise<boolean> {
  const now = Date.now();
  const row = await db.prepare(
    "SELECT blocked_until AS blockedUntil FROM admin_login_attempts WHERE ip_hash = ?",
  ).bind(ipHash).first() as { blockedUntil?: number } | null;
  return !row || Number(row.blockedUntil ?? 0) <= now;
}

async function recordLoginFailure(db: CatalogDatabase, ipHash: string): Promise<void> {
  const now = Date.now();
  const current = await db.prepare(
    `SELECT window_started_at AS windowStartedAt, failed_count AS failedCount
     FROM admin_login_attempts WHERE ip_hash = ?`,
  ).bind(ipHash).first() as { windowStartedAt?: number; failedCount?: number } | null;
  const inWindow = current && now - Number(current.windowStartedAt ?? 0) < LOGIN_WINDOW_MS;
  const failedCount = inWindow ? Number(current.failedCount ?? 0) + 1 : 1;
  const windowStartedAt = inWindow ? Number(current.windowStartedAt) : now;
  const blockedUntil = failedCount >= LOGIN_MAX_FAILURES ? now + LOGIN_WINDOW_MS : 0;
  await db.prepare(
    `INSERT INTO admin_login_attempts (ip_hash, window_started_at, failed_count, blocked_until)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(ip_hash) DO UPDATE SET
       window_started_at = excluded.window_started_at,
       failed_count = excluded.failed_count,
       blocked_until = excluded.blocked_until`,
  ).bind(ipHash, windowStartedAt, failedCount, blockedUntil).run();
}

async function clearLoginFailures(db: CatalogDatabase, ipHash: string): Promise<void> {
  await db.prepare("DELETE FROM admin_login_attempts WHERE ip_hash = ?").bind(ipHash).run();
}

// Schema checks are needed for a new local/production database, but running the
// full CREATE/PRAGMA sequence on every request delays the public catalogue long
// enough for browsers to abandon it. Keep one safe, shared readiness promise
// for the lifetime of this Worker isolate; reset it only if setup fails.
let catalogSchemaReady: Promise<void> | null = null;

async function prepareCatalog(db: CatalogDatabase): Promise<void> {
  if (!catalogSchemaReady) {
    catalogSchemaReady = ensureCatalogSchema(db);
  }
  try {
    await catalogSchemaReady;
  } catch (error) {
    catalogSchemaReady = null;
    throw error;
  }
}

async function getAdminPret(db: CatalogDatabase) {
  const result = await db
    .prepare(
      `SELECT
         cp.id,
         cp.public_title AS publicTitle,
         cp.cost_price_pkr AS costPricePkr,
         cp.selling_price_pkr AS sellingPricePkr,
         cp.overhead_pkr AS overheadPkr,
         cp.target_margin_bps AS targetMarginBps,
         cp.pricing_status AS pricingStatus,
         cp.publish_status AS publishStatus,
         cp.supply_mode AS supplyMode,
         cp.stock_qty AS stockQty,
         sp.handle,
         sp.title AS supplierTitle,
         sp.source_price_pkr AS sourcePricePkr,
         sp.source_url AS sourceUrl,
         sp.image_url AS imageUrl,
         sp.variants_json AS variantsJson,
         sp.source_available AS sourceAvailable
       FROM catalog_products cp
       JOIN supplier_products sp ON sp.id = cp.supplier_product_id
       WHERE cp.category = 'pret'
       ORDER BY sp.title ASC`,
    )
    .all();

  return (result.results ?? []).map((row) => ({
    ...row,
    inventorySource: "imported",
    sourceAvailable: Boolean(row.sourceAvailable),
    variants: JSON.parse(String(row.variantsJson ?? "[]")),
    variantsJson: undefined,
  }));
}

type CatalogUpdate = {
  id?: string;
  publicTitle?: string;
  costPricePkr?: number | null;
  sellingPricePkr?: number | null;
  overheadPkr?: number;
  targetMarginBps?: number;
  supplyMode?: string;
  stockQty?: number;
  sizeStock?: Array<{ title?: string; stockQty?: number }>;
  action?: string;
};

function positiveInteger(value: unknown): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

async function updateAdminPret(db: CatalogDatabase, input: CatalogUpdate) {
  const id = String(input.id ?? "");
  const publicTitle = String(input.publicTitle ?? "").trim();
  const costPricePkr =
    input.costPricePkr == null ? null : positiveInteger(input.costPricePkr);
  const sellingPricePkr =
    input.sellingPricePkr == null
      ? null
      : positiveInteger(input.sellingPricePkr);
  const overheadPkr = Math.max(0, Math.round(Number(input.overheadPkr ?? 250)));
  const targetMarginBps = Math.round(Number(input.targetMarginBps ?? 2500));
  const supplyMode =
    input.supplyMode === "owned_stock" ? "owned_stock" : "on_demand";
  const stockQty = Math.max(0, Math.round(Number(input.stockQty ?? 0)));
  const action = String(input.action ?? "save");

  if (!id || !publicTitle) {
    throw new Error("Article title is required.");
  }
  if (!Number.isFinite(overheadPkr) || overheadPkr < 0) {
    throw new Error("Packing and return allowance must be zero or higher.");
  }
  if (
    !Number.isFinite(targetMarginBps) ||
    targetMarginBps < 0 ||
    targetMarginBps >= 8000
  ) {
    throw new Error("Margin must be between 0% and 79.99%.");
  }

  const current = await db
    .prepare(
      `SELECT cp.id, sp.source_available AS sourceAvailable
       FROM catalog_products cp
       JOIN supplier_products sp ON sp.id = cp.supplier_product_id
       WHERE cp.id = ?`,
    )
    .bind(id)
    .first<{ id: string; sourceAvailable: number }>();
  if (!current) throw new Error("Article was not found.");

  if (action === "publish") {
    if (costPricePkr == null || sellingPricePkr == null) {
      throw new Error("Set buying cost and Haley Wali price before publishing.");
    }
    if (sellingPricePkr <= costPricePkr + overheadPkr) {
      throw new Error("Selling price must be higher than total article cost.");
    }
    if (supplyMode === "owned_stock" && stockQty < 1) {
      throw new Error("Enter owned stock quantity before publishing.");
    }
    if (supplyMode === "on_demand" && !Boolean(current.sourceAvailable)) {
      throw new Error("This supplier article is currently unavailable.");
    }
  }

  const pricingStatus =
    costPricePkr != null && sellingPricePkr != null
      ? "approved"
      : "awaiting_cost";
  const publishStatus =
    action === "publish"
      ? "published"
      : action === "unpublish"
        ? "draft"
        : undefined;
  const now = new Date().toISOString();

  await db
    .prepare(
      `UPDATE catalog_products SET
         public_title = ?,
         cost_price_pkr = ?,
         selling_price_pkr = ?,
         overhead_pkr = ?,
         target_margin_bps = ?,
         pricing_status = ?,
         publish_status = COALESCE(?, publish_status),
         supply_mode = ?,
         stock_qty = ?,
         updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      publicTitle,
      costPricePkr,
      sellingPricePkr,
      overheadPkr,
      targetMarginBps,
      pricingStatus,
      publishStatus ?? null,
      supplyMode,
      stockQty,
      now,
      id,
    )
    .run();

  return getAdminPret(db);
}

function supplierDescriptionText(value: unknown): string {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

async function promoteImportedProduct(db: CatalogDatabase, input: CatalogUpdate) {
  const id = String(input.id ?? "");
  const publicTitle = String(input.publicTitle ?? "").trim();
  const costPricePkr = input.costPricePkr == null ? null : positiveInteger(input.costPricePkr);
  const sellingPricePkr = input.sellingPricePkr == null ? null : positiveInteger(input.sellingPricePkr);
  const overheadPkr = Math.max(0, Math.round(Number(input.overheadPkr ?? 250)));
  const sizeStock = Array.isArray(input.sizeStock)
    ? input.sizeStock
        .map((variant) => ({
          title: String(variant.title ?? "").trim(),
          stockQty: Math.max(0, Math.round(Number(variant.stockQty ?? 0))),
        }))
        .filter((variant) => variant.title)
    : [];
  const stockQty = sizeStock.reduce((total, variant) => total + variant.stockQty, 0);

  if (!id || !publicTitle) throw new Error("Article title is required.");
  if (costPricePkr == null || sellingPricePkr == null) {
    throw new Error("Set buying cost and Haley Wali price before publishing this article.");
  }
  if (sellingPricePkr <= costPricePkr + overheadPkr) {
    throw new Error("Selling price must be higher than total article cost.");
  }
  if (!sizeStock.some((variant) => variant.stockQty > 0)) {
    throw new Error("Enter stock for at least one size before publishing this article.");
  }

  const row = await db.prepare(
     `SELECT
       cp.id,
       cp.supplier_product_id AS supplierProductId,
       sp.handle,
       sp.description_html AS descriptionHtml,
       sp.image_url AS imageUrl,
       sp.gallery_json AS galleryJson,
       sp.variants_json AS variantsJson
     FROM catalog_products cp
     JOIN supplier_products sp ON sp.id = cp.supplier_product_id
     WHERE cp.id = ? AND cp.category = 'pret'`,
  ).bind(id).first() as Record<string, unknown> | null;
  if (!row) throw new Error("Imported article was not found.");

  const sourceSizes = new Set(
    parseJsonArray(row.variantsJson)
      .map((variant) => String((variant as { title?: unknown }).title ?? "").trim().toLocaleLowerCase("en"))
      .filter(Boolean),
  );
  if (sizeStock.some((variant) => !sourceSizes.has(variant.title.toLocaleLowerCase("en")))) {
    throw new Error("Choose stock only for sizes supplied with this article.");
  }
  const duplicateSize = sizeStock.some((variant, index) =>
    sizeStock.findIndex((item) => item.title.toLocaleLowerCase("en") === variant.title.toLocaleLowerCase("en")) !== index,
  );
  if (duplicateSize) throw new Error("Each size can be entered only once.");

  const existing = await db.prepare("SELECT id FROM manual_products WHERE id = ?").bind(id).first();
  if (existing) throw new Error("This imported article is already available in Articles.");

  const now = new Date().toISOString();
  const gallery = parseJsonArray(row.galleryJson).map(String).filter(Boolean);
  const imageUrl = String(row.imageUrl ?? "").trim() || null;
  const description = supplierDescriptionText(row.descriptionHtml)
    || "A branded ready-to-wear article available in the listed sizes.";
  const piecesMatch = publicTitle.match(/\b(\d+)\s*(?:pc|piece)/i);
  const pieces = piecesMatch ? `${piecesMatch[1]} Piece` : "See article details";
  const variants = sizeStock.map((variant) => ({ ...variant, available: variant.stockQty > 0 }));

  await db.batch([
    db.prepare(
      `INSERT INTO manual_products (
         id, collection, garment_type, brand, public_title, article_code, subtitle,
         description, image_url, gallery_json, variants_json, pieces, fabric,
         season, color, care, shirt_details, trouser_details, dupatta_details,
         model_details, measurements_json, includes_json, cost_price_pkr, selling_price_pkr,
         publish_status, stock_qty, created_at, updated_at
       ) VALUES (?, 'branded', 'pret', 'Other Brands', ?, ?, 'Ready to Wear Suit',
         ?, ?, ?, ?, ?, 'See article details', 'All Season', 'As shown',
         'Follow the care label', '', '', '', '', '[]', ?, ?, ?, 'published', ?, ?, ?)`,
    ).bind(
      id,
      publicTitle,
      String(row.handle ?? ""),
      description,
      imageUrl,
      JSON.stringify([...new Set([imageUrl, ...gallery].filter(Boolean))]),
      JSON.stringify(variants),
      pieces,
      JSON.stringify(["Ready-to-wear article as shown"]),
      costPricePkr,
      sellingPricePkr,
      stockQty,
      now,
      now,
    ),
    ...sizeStock.map((variant) => db.prepare(
      "INSERT INTO manual_variant_stock (product_id, size, stock_qty) VALUES (?, ?, ?)",
    ).bind(id, variant.title, variant.stockQty)),
    db.prepare("DELETE FROM catalog_products WHERE id = ?").bind(id),
    db.prepare("DELETE FROM supplier_products WHERE id = ?").bind(String(row.supplierProductId ?? "")),
  ]);

  return { products: await getAdminPret(db), promotedId: id };
}

async function archiveImportedProduct(db: CatalogDatabase, id: string) {
  if (!id) throw new Error("Article id is required.");
  await db
    .prepare(
      `UPDATE catalog_products
       SET category = 'archived', publish_status = 'draft', updated_at = ?
       WHERE id = ?`,
    )
    .bind(new Date().toISOString(), id)
    .run();
  return getAdminPret(db);
}

async function getPublishedPret(db: CatalogDatabase) {
  const result = await db
    .prepare(
      `SELECT
         cp.id,
         cp.public_title AS title,
         cp.selling_price_pkr AS pricePkr,
         sp.image_url AS imageUrl,
         sp.gallery_json AS galleryJson,
         sp.variants_json AS variantsJson,
         cp.supply_mode AS supplyMode,
         cp.stock_qty AS stockQty,
         sp.handle,
         sp.source_available AS sourceAvailable
       FROM catalog_products cp
       JOIN supplier_products sp ON sp.id = cp.supplier_product_id
       WHERE cp.category = 'pret'
         AND cp.publish_status = 'published'
         AND cp.selling_price_pkr IS NOT NULL
       ORDER BY cp.updated_at DESC`,
    )
    .all();

  return (result.results ?? []).map((row) => ({
    ...row,
    inventorySource: "imported",
    brand: "Branded",
    collection: "branded",
    garmentType: "pret",
    pieces: "Ready to Wear",
    description: "A branded ready-to-wear article available in the listed sizes.",
    fabric: "See article details",
    color: "As shown",
    care: "Follow the care instructions on the article.",
    includes: ["Ready-to-wear article as shown"],
    gallery: JSON.parse(String(row.galleryJson ?? "[]")),
    variants: JSON.parse(String(row.variantsJson ?? "[]")),
    sourceAvailable: Boolean(row.sourceAvailable),
    galleryJson: undefined,
    variantsJson: undefined,
  }));
}

function parseJsonArray(value: unknown): unknown[] {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function getManualProducts(db: CatalogDatabase, publishedOnly = false) {
  const result = await db
    .prepare(
      `SELECT
         id,
         collection,
         garment_type AS garmentType,
         brand,
         public_title AS title,
         article_code AS articleCode,
         subtitle,
         description,
         image_url AS imageUrl,
         gallery_json AS galleryJson,
         variants_json AS variantsJson,
         pieces,
         season,
         fabric,
         color,
         care,
         shirt_details AS shirtDetails,
         trouser_details AS trouserDetails,
         dupatta_details AS dupattaDetails,
         model_details AS modelDetails,
         measurements_json AS measurementsJson,
         includes_json AS includesJson,
         cost_price_pkr AS costPricePkr,
         selling_price_pkr AS pricePkr,
         publish_status AS publishStatus,
         stock_qty AS stockQty,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM manual_products
       ${publishedOnly ? "WHERE publish_status = 'published' AND selling_price_pkr IS NOT NULL" : ""}
       ORDER BY updated_at DESC`,
    )
    .all();

  return (result.results ?? []).map((row) => ({
    ...row,
    inventorySource: "manual",
    gallery: parseJsonArray(row.galleryJson),
    variants: parseJsonArray(row.variantsJson),
    includes: parseJsonArray(row.includesJson),
    measurements: parseJsonArray(row.measurementsJson),
    galleryJson: undefined,
    variantsJson: undefined,
    includesJson: undefined,
    measurementsJson: undefined,
  }));
}

async function getPublishedArticles(db: CatalogDatabase) {
  const [manual, imported, reviewSummaryResult] = await Promise.all([
    getManualProducts(db, true),
    getPublishedPret(db),
    db.prepare(
      `SELECT product_id AS productId, COUNT(*) AS reviewCount, ROUND(AVG(rating), 1) AS reviewAverage
       FROM product_reviews
       WHERE status = 'approved'
       GROUP BY product_id`,
    ).all(),
  ]);
  const reviewSummaries = new Map(
    (reviewSummaryResult.results ?? []).map((summary) => [String(summary.productId), {
      reviewCount: Number(summary.reviewCount ?? 0),
      reviewAverage: Number(summary.reviewAverage ?? 0),
    }]),
  );
  return [...manual, ...imported].map((article) => ({
    ...article,
    ...(reviewSummaries.get(String(article.id)) ?? { reviewCount: 0, reviewAverage: 0 }),
  }));
}

type ManualProductInput = {
  id?: string;
  collection?: string;
  garmentType?: string;
  brand?: string;
  title?: string;
  articleCode?: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  gallery?: string[];
  pieces?: string;
  season?: string;
  fabric?: string;
  color?: string;
  care?: string;
  shirtDetails?: string;
  trouserDetails?: string;
  dupattaDetails?: string;
  modelDetails?: string;
  sizeStock?: Array<{ title?: string; stockQty?: number }>;
  measurements?: Array<{ label?: string; value?: string }>;
  includes?: string[];
  costPricePkr?: number | null;
  pricePkr?: number | null;
  stockQty?: number;
  action?: string;
};

function cleanProductInput(input: ManualProductInput, approvedBrandName?: string | null) {
  const title = String(input.title ?? "").trim();
  const collection = input.collection === "branded" ? "branded" : "exclusive";
  const brand = collection === "exclusive"
    ? "Haley Wali"
    : approvedBrandName ?? approvedArticleBrand(input.brand)?.name;
  const pricePkr =
    input.pricePkr == null ? null : positiveInteger(input.pricePkr);
  const costPricePkr =
    input.costPricePkr == null ? null : positiveInteger(input.costPricePkr);
  const garmentType = input.garmentType === "pret" ? "pret" : "unstitched";
  const sizeStock = Array.isArray(input.sizeStock)
    ? input.sizeStock
        .map((variant) => ({
          title: String(variant.title ?? "").trim(),
          stockQty: Math.max(0, Math.round(Number(variant.stockQty ?? 0))),
        }))
        .filter((variant) => variant.title)
    : [];
  const stockQty = garmentType === "pret"
    ? sizeStock.reduce((total, variant) => total + variant.stockQty, 0)
    : Math.max(0, Math.round(Number(input.stockQty ?? 0)));
  if (!title) throw new Error("Article name is required.");
  if (!brand) {
    throw new Error("Choose an approved brand. Use AI Suggestions if the spelling is uncertain.");
  }
  if (input.action === "publish" && (pricePkr == null || stockQty < 1)) {
    throw new Error("Set a selling price and stock quantity before publishing.");
  }
  if (input.action === "publish") {
    if (!String(input.imageUrl ?? "").trim()) throw new Error("Add a main article image before publishing.");
    if (!String(input.description ?? "").trim()) throw new Error("Add a clear article description before publishing.");
    if (!String(input.fabric ?? "").trim() || !String(input.pieces ?? "").trim()) {
      throw new Error("Add the fabric and number of pieces before publishing.");
    }
    if (!Array.isArray(input.includes) || !input.includes.some((item) => String(item).trim())) {
      throw new Error("List what is included with the article before publishing.");
    }
    if (garmentType === "pret" && !sizeStock.some((variant) => variant.stockQty > 0)) {
      throw new Error("Add stock for at least one Pret size before publishing.");
    }
    if (garmentType === "pret" && (!Array.isArray(input.measurements) || !input.measurements.length)) {
      throw new Error("Add Pret measurements before publishing.");
    }
  }
  return {
    id: String(input.id || `manual:${crypto.randomUUID()}`),
    collection,
    garmentType,
    brand,
    title,
    articleCode: String(input.articleCode || "").trim(),
    subtitle: String(input.subtitle || "Clothing Article").trim(),
    description: String(input.description || "").trim(),
    imageUrl: String(input.imageUrl || "").trim() || null,
    gallery: Array.isArray(input.gallery)
      ? input.gallery.map((url) => String(url).trim()).filter(Boolean)
      : [],
    pieces: String(input.pieces || "1 Piece").trim(),
    season: String(input.season || "All Season").trim(),
    fabric: String(input.fabric || "See article details").trim(),
    color: String(input.color || "As shown").trim(),
    care: String(input.care || "Follow the care label").trim(),
    shirtDetails: String(input.shirtDetails || "").trim(),
    trouserDetails: String(input.trouserDetails || "").trim(),
    dupattaDetails: String(input.dupattaDetails || "").trim(),
    modelDetails: String(input.modelDetails || "").trim(),
    sizeStock,
    measurements: Array.isArray(input.measurements)
      ? input.measurements
          .map((measurement) => ({
            label: String(measurement.label ?? "").trim(),
            value: String(measurement.value ?? "").trim(),
          }))
          .filter((measurement) => measurement.label && measurement.value)
      : [],
    includes: Array.isArray(input.includes)
      ? input.includes.map((item) => String(item).trim()).filter(Boolean)
      : [],
    costPricePkr,
    pricePkr,
    stockQty,
    action: String(input.action || "save"),
  };
}

async function replaceManualVariantStock(
  db: CatalogDatabase,
  productId: string,
  variants: Array<{ title: string; stockQty: number }>,
) {
  await db.batch([
    db.prepare("DELETE FROM manual_variant_stock WHERE product_id = ?").bind(productId),
    ...variants.map((variant) =>
      db
        .prepare("INSERT INTO manual_variant_stock (product_id, size, stock_qty) VALUES (?, ?, ?)")
        .bind(productId, variant.title, variant.stockQty),
    ),
  ]);
}

async function createManualProduct(
  db: CatalogDatabase,
  input: ManualProductInput,
) {
  const approvedBrandName = input.collection === "branded"
    ? await canonicalApprovedArticleBrand(db, input.brand)
    : null;
  const article = cleanProductInput(input, approvedBrandName);
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO manual_products (
         id, collection, garment_type, brand, public_title, article_code, subtitle,
         description, image_url, gallery_json, variants_json, pieces, fabric,
         season, color, care, shirt_details, trouser_details, dupatta_details,
         model_details, measurements_json, includes_json, cost_price_pkr, selling_price_pkr,
         publish_status, stock_qty, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      article.id,
      article.collection,
      article.garmentType,
      article.brand,
      article.title,
      article.articleCode,
      article.subtitle,
      article.description,
      article.imageUrl,
      JSON.stringify([...new Set([article.imageUrl, ...article.gallery].filter(Boolean))]),
      JSON.stringify(
        article.sizeStock.map((variant) => ({ ...variant, available: variant.stockQty > 0 })),
      ),
      article.pieces,
      article.fabric,
      article.season,
      article.color,
      article.care,
      article.shirtDetails,
      article.trouserDetails,
      article.dupattaDetails,
      article.modelDetails,
      JSON.stringify(article.measurements),
      JSON.stringify(article.includes),
      article.costPricePkr,
      article.pricePkr,
      article.action === "publish" ? "published" : "draft",
      article.stockQty,
      now,
      now,
    )
    .run();
  await replaceManualVariantStock(db, article.id, article.sizeStock);
  return getManualProducts(db);
}

async function updateManualProduct(
  db: CatalogDatabase,
  env: Env,
  input: ManualProductInput,
) {
  const approvedBrandName = input.collection === "branded"
    ? await canonicalApprovedArticleBrand(db, input.brand)
    : null;
  const article = cleanProductInput(input, approvedBrandName);
  const current = await db
    .prepare("SELECT id, image_url AS imageUrl, gallery_json AS galleryJson FROM manual_products WHERE id = ?")
    .bind(article.id)
    .first() as { id?: string; imageUrl?: string | null; galleryJson?: string | null } | null;
  if (!current) throw new Error("Article was not found.");
  const previousImages = [current.imageUrl, ...parseJsonArray(current.galleryJson)];
  const nextImages = new Set([article.imageUrl, ...article.gallery].filter(Boolean));
  const publishStatus =
    article.action === "publish"
      ? "published"
      : article.action === "unpublish"
        ? "draft"
        : null;
  await db
    .prepare(
      `UPDATE manual_products SET
         collection = ?, garment_type = ?, brand = ?, public_title = ?,
         article_code = ?, subtitle = ?, description = ?, image_url = ?, gallery_json = ?,
         variants_json = ?, pieces = ?, fabric = ?, season = ?, color = ?, care = ?,
         shirt_details = ?, trouser_details = ?, dupatta_details = ?, model_details = ?,
         measurements_json = ?, includes_json = ?, cost_price_pkr = ?, selling_price_pkr = ?,
         publish_status = COALESCE(?, publish_status), stock_qty = ?,
         updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      article.collection,
      article.garmentType,
      article.brand,
      article.title,
      article.articleCode,
      article.subtitle,
      article.description,
      article.imageUrl,
      JSON.stringify([...new Set([article.imageUrl, ...article.gallery].filter(Boolean))]),
      JSON.stringify(
        article.sizeStock.map((variant) => ({ ...variant, available: variant.stockQty > 0 })),
      ),
      article.pieces,
      article.fabric,
      article.season,
      article.color,
      article.care,
      article.shirtDetails,
      article.trouserDetails,
      article.dupattaDetails,
      article.modelDetails,
      JSON.stringify(article.measurements),
      JSON.stringify(article.includes),
      article.costPricePkr,
      article.pricePkr,
      publishStatus,
      article.stockQty,
      new Date().toISOString(),
      article.id,
    )
    .run();
  await replaceManualVariantStock(db, article.id, article.sizeStock);
  await deleteUnreferencedArticleImages(
    db,
    env,
    previousImages.filter((url) => !nextImages.has(String(url))),
  );
  return getManualProducts(db);
}

async function removeManualProduct(db: CatalogDatabase, env: Env, id: string) {
  if (!id) throw new Error("Article id is required.");
  const current = await db.prepare(
    "SELECT image_url AS imageUrl, gallery_json AS galleryJson FROM manual_products WHERE id = ?",
  ).bind(id).first() as { imageUrl?: string | null; galleryJson?: string | null } | null;
  await db.prepare("DELETE FROM manual_products WHERE id = ?").bind(id).run();
  if (current) {
    await deleteUnreferencedArticleImages(
      db,
      env,
      [current.imageUrl, ...parseJsonArray(current.galleryJson)],
    );
  }
  return getManualProducts(db);
}

type OfferRecord = {
  id: string;
  code: string;
  name: string;
  status: string;
  discountType: string;
  discountValue: number;
  freeDelivery: number;
  appliesTo: string;
  minSubtotalPkr: number | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  perPhone: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type PricedBagLine = {
  productId: string;
  title: string;
  size: string;
  quantity: number;
  unitPricePkr: number;
  collection: "exclusive" | "branded";
  article: Record<string, unknown>;
};

type CheckoutQuote = {
  subtotalPkr: number;
  discountPkr: number;
  deliveryPkr: number;
  totalPkr: number;
  code: string | null;
  label: string | null;
  offer: OfferRecord | null;
};

const DEFAULT_DELIVERY_PKR = 250;
const DEFAULT_SALE_PERCENT = 10;
const DEFAULT_SALE_NAME = "Season End Sale";
const DEFAULT_SALE_DESCRIPTION = "The reduced price is already shown across HW Exclusive and Branded articles. No sale code is needed.";
type StoreSettingsRecord = {
  deliveryPkr: number;
  saleActive: boolean;
  salePercent: number;
  saleName: string;
  saleDescription: string;
};
const OFFER_SELECT = `id, code, name, status,
         discount_type AS discountType, discount_value AS discountValue,
         free_delivery AS freeDelivery, applies_to AS appliesTo,
         min_subtotal_pkr AS minSubtotalPkr, max_redemptions AS maxRedemptions,
         redemption_count AS redemptionCount, per_phone AS perPhone,
         starts_at AS startsAt, ends_at AS endsAt,
         created_at AS createdAt, updated_at AS updatedAt`;

function wholeRupees(value: unknown, field: string, allowZero = true): number {
  if (value === null || value === undefined || String(value).trim() === "") {
    throw new Error(`${field} must be a whole rupee amount.`);
  }
  const amount = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < 0 || (!allowZero && amount === 0)) {
    throw new Error(`${field} must be a whole rupee amount.`);
  }
  return amount;
}

function normalizeOfferCode(value: unknown): string {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

function optionalWholeRupees(value: unknown, field: string): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const amount = wholeRupees(value, field, true);
  return amount;
}

function optionalIsoDate(value: unknown, field: string, endOfDay = false): string | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const raw = String(value).trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const parsed = new Date(dateOnly ? `${raw}T${endOfDay ? "23:59:59.999Z" : "00:00:00.000Z"}` : raw);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${field} is not a valid date.`);
  return parsed.toISOString();
}

function articleCollection(article: Record<string, unknown>): "exclusive" | "branded" {
  return String(article.collection ?? "") === "exclusive" ? "exclusive" : "branded";
}

function mapOfferRow(row: Record<string, unknown>): OfferRecord {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    status: String(row.status),
    discountType: String(row.discountType),
    discountValue: Number(row.discountValue ?? 0),
    freeDelivery: Number(row.freeDelivery ?? 0),
    appliesTo: String(row.appliesTo ?? "all"),
    minSubtotalPkr: row.minSubtotalPkr == null ? null : Number(row.minSubtotalPkr),
    maxRedemptions: row.maxRedemptions == null ? null : Number(row.maxRedemptions),
    redemptionCount: Number(row.redemptionCount ?? 0),
    perPhone: Number(row.perPhone ?? 0),
    startsAt: row.startsAt == null ? null : String(row.startsAt),
    endsAt: row.endsAt == null ? null : String(row.endsAt),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function publicOffer(offer: OfferRecord) {
  return {
    id: offer.id,
    code: offer.code,
    name: offer.name,
    status: offer.status,
    discountType: offer.discountType,
    discountValue: offer.discountValue,
    freeDelivery: Boolean(offer.freeDelivery),
    appliesTo: offer.appliesTo,
    minSubtotalPkr: offer.minSubtotalPkr,
    maxRedemptions: offer.maxRedemptions,
    redemptionCount: offer.redemptionCount,
    perPhone: Boolean(offer.perPhone),
    startsAt: offer.startsAt,
    endsAt: offer.endsAt,
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
  };
}

function offerLabel(offer: OfferRecord, discountPkr: number): string {
  const parts: string[] = [];
  if (discountPkr > 0) {
    parts.push(
      offer.discountType === "percent"
        ? `${offer.discountValue}% off`
        : `PKR ${discountPkr.toLocaleString("en-PK")} off`,
    );
  }
  if (offer.freeDelivery) parts.push("Free delivery");
  return parts.length ? `${offer.code} · ${parts.join(" · ")}` : offer.code;
}

function validSalePercent(value: unknown): number {
  const percent = Number(value);
  if (!Number.isInteger(percent) || percent < 0 || percent > 90) {
    throw new Error("Sale percentage must be a whole number from 0 to 90.");
  }
  return percent;
}

function applySeasonSalePrice(pricePkr: number, settings: Pick<StoreSettingsRecord, "saleActive" | "salePercent">) {
  if (!settings.saleActive || settings.salePercent <= 0) return pricePkr;
  return Math.max(1, Math.floor((pricePkr * (100 - settings.salePercent)) / 100));
}

async function getStoreSettings(db: CatalogDatabase): Promise<StoreSettingsRecord> {
  const row = await db
    .prepare(
      `SELECT delivery_pkr AS deliveryPkr, sale_active AS saleActive,
              sale_percent AS salePercent, sale_name AS saleName,
              sale_description AS saleDescription
       FROM store_settings WHERE id = 'default'`,
    )
    .first<Record<string, unknown>>();
  const deliveryPkr = Number(row?.deliveryPkr);
  const salePercent = Number(row?.salePercent);
  return {
    deliveryPkr: Number.isInteger(deliveryPkr) && deliveryPkr >= 0 ? deliveryPkr : DEFAULT_DELIVERY_PKR,
    saleActive: Boolean(Number(row?.saleActive ?? 1)),
    salePercent: Number.isInteger(salePercent) && salePercent >= 0 && salePercent <= 90
      ? salePercent
      : DEFAULT_SALE_PERCENT,
    saleName: String(row?.saleName ?? DEFAULT_SALE_NAME).trim() || DEFAULT_SALE_NAME,
    saleDescription: String(row?.saleDescription ?? DEFAULT_SALE_DESCRIPTION).trim() || DEFAULT_SALE_DESCRIPTION,
  };
}

async function updateStoreSettings(
  db: CatalogDatabase,
  input: { deliveryPkr?: unknown; saleActive?: unknown; salePercent?: unknown; saleName?: unknown; saleDescription?: unknown },
) {
  const current = await getStoreSettings(db);
  const deliveryPkr = input.deliveryPkr === undefined
    ? current.deliveryPkr
    : wholeRupees(input.deliveryPkr, "Nationwide delivery", true);
  const saleActive = input.saleActive === undefined ? current.saleActive : Boolean(input.saleActive);
  const salePercent = input.salePercent === undefined ? current.salePercent : validSalePercent(input.salePercent);
  const saleName = input.saleName === undefined ? current.saleName : String(input.saleName).trim();
  const saleDescription = input.saleDescription === undefined
    ? current.saleDescription
    : String(input.saleDescription).trim();
  if (saleName.length < 3 || saleName.length > 60) throw new Error("Sale name must be 3–60 characters.");
  if (saleDescription.length > 180) throw new Error("Sale description must be 180 characters or fewer.");
  if (saleActive && salePercent === 0) throw new Error("Choose a sale percentage or turn the sale off.");
  await db
    .prepare(
      `INSERT INTO store_settings (
         id, delivery_pkr, sale_active, sale_percent, sale_name, sale_description, updated_at
       ) VALUES ('default', ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         delivery_pkr = excluded.delivery_pkr,
         sale_active = excluded.sale_active,
         sale_percent = excluded.sale_percent,
         sale_name = excluded.sale_name,
         sale_description = excluded.sale_description,
         updated_at = excluded.updated_at`,
    )
    .bind(deliveryPkr, saleActive ? 1 : 0, salePercent, saleName, saleDescription, new Date().toISOString())
    .run();
  return getStoreSettings(db);
}

function combineBagItems(inputItems: Array<{ id?: string; size?: string; quantity?: number }>) {
  const combined = new Map<string, { id?: string; size?: string; quantity?: number }>();
  for (const item of inputItems) {
    const key = `${String(item.id ?? "")}::${String(item.size || "Standard")}`;
    const previous = combined.get(key);
    combined.set(key, { ...item, quantity: Number(previous?.quantity ?? 0) + Number(item.quantity ?? 1) });
  }
  return [...combined.values()];
}

function priceBagLines(
  catalog: Array<Record<string, unknown>>,
  inputItems: Array<{ id?: string; size?: string; quantity?: number }>,
  settings: Pick<StoreSettingsRecord, "saleActive" | "salePercent">,
): PricedBagLine[] {
  const byId = new Map(catalog.map((article) => [String(article.id), article]));
  return combineBagItems(inputItems).map((item) => {
    const article = byId.get(String(item.id ?? ""));
    const quantity = Math.max(1, Math.min(10, Math.round(Number(item.quantity ?? 1))));
    if (!article || !article.pricePkr) {
      throw new Error("One of the articles is no longer available.");
    }
    const size = String(item.size || "Standard");
    const garmentType = String(article.garmentType ?? "pret");
    const variants = Array.isArray(article.variants)
      ? article.variants as Array<{ title?: string; available?: boolean; stockQty?: number }>
      : [];
    if (garmentType === "pret" && !variants.some((candidate) => candidate.title === size && candidate.available)) {
      throw new Error(`${article.title} is not available in size ${size}.`);
    }
    return {
      productId: String(article.id),
      title: String(article.title),
      size,
      quantity,
      unitPricePkr: applySeasonSalePrice(Number(article.pricePkr), settings),
      collection: articleCollection(article),
      article,
    };
  });
}

async function loadOfferByCode(db: CatalogDatabase, code: string): Promise<OfferRecord | null> {
  const row = await db
    .prepare(`SELECT ${OFFER_SELECT} FROM offer_codes WHERE code = ?`)
    .bind(code)
    .first<Record<string, unknown>>();
  return row ? mapOfferRow(row) : null;
}

function quoteFromOffer(
  lines: PricedBagLine[],
  storeDeliveryPkr: number,
  offer: OfferRecord | null,
  options: { phone?: string; skipLimitCheck?: boolean } = {},
): CheckoutQuote {
  const subtotalPkr = lines.reduce((total, line) => total + line.unitPricePkr * line.quantity, 0);
  if (!offer) {
    return {
      subtotalPkr,
      discountPkr: 0,
      deliveryPkr: storeDeliveryPkr,
      totalPkr: subtotalPkr + storeDeliveryPkr,
      code: null,
      label: null,
      offer: null,
    };
  }
  const now = new Date().toISOString();
  if (offer.status !== "active") throw new Error("This code is not available.");
  if (offer.startsAt && now < offer.startsAt) throw new Error("This code is not active yet.");
  if (offer.endsAt && now > offer.endsAt) throw new Error("This code has ended.");
  if (!options.skipLimitCheck && offer.maxRedemptions != null && offer.redemptionCount >= offer.maxRedemptions) {
    throw new Error("This code has reached its use limit.");
  }
  if (offer.minSubtotalPkr != null && subtotalPkr < offer.minSubtotalPkr) {
    throw new Error("Your bag does not meet the minimum amount for this code.");
  }
  const eligibleSubtotal = offer.appliesTo === "all"
    ? subtotalPkr
    : lines
      .filter((line) => line.collection === offer.appliesTo)
      .reduce((total, line) => total + line.unitPricePkr * line.quantity, 0);
  if (eligibleSubtotal <= 0) {
    throw new Error("This code does not apply to the articles in your bag.");
  }
  let discountPkr = 0;
  if (offer.discountType === "percent") {
    discountPkr = Math.floor((eligibleSubtotal * offer.discountValue) / 100);
  } else {
    discountPkr = Math.min(offer.discountValue, eligibleSubtotal);
  }
  discountPkr = Math.max(0, Math.min(discountPkr, subtotalPkr));
  const deliveryPkr = offer.freeDelivery ? 0 : storeDeliveryPkr;
  return {
    subtotalPkr,
    discountPkr,
    deliveryPkr,
    totalPkr: subtotalPkr - discountPkr + deliveryPkr,
    code: offer.code,
    label: offerLabel(offer, discountPkr),
    offer,
  };
}

async function quoteBag(
  db: CatalogDatabase,
  input: { items?: Array<{ id?: string; size?: string; quantity?: number }>; code?: string; phone?: string },
): Promise<CheckoutQuote> {
  if (!Array.isArray(input.items) || !input.items.length) {
    throw new Error("Your bag is empty.");
  }
  const catalog = await getPublishedArticles(db);
  const settings = await getStoreSettings(db);
  const lines = priceBagLines(catalog as Array<Record<string, unknown>>, input.items, settings);
  const storeDeliveryPkr = settings.deliveryPkr;
  const requested = normalizeOfferCode(input.code);
  if (requested && settings.saleActive && settings.salePercent > 0) {
    throw new Error(`${settings.saleName} is already applied and cannot be combined with an offer code.`);
  }
  if (!requested) return quoteFromOffer(lines, storeDeliveryPkr, null);
  const offer = await loadOfferByCode(db, requested);
  if (!offer) throw new Error("This code is not available.");
  const quote = quoteFromOffer(lines, storeDeliveryPkr, offer);
  const phone = String(input.phone ?? "").replace(/\s+/g, "");
  if (offer.perPhone && /^03\d{9}$/.test(phone)) {
    const used = await db
      .prepare("SELECT id FROM offer_redemptions WHERE offer_id = ? AND phone = ? LIMIT 1")
      .bind(offer.id, phone)
      .first();
    if (used) throw new Error("This code has already been used with this mobile number.");
  }
  return quote;
}

type OfferInput = {
  id?: string;
  code?: string;
  name?: string;
  status?: string;
  discountType?: string;
  discountValue?: unknown;
  freeDelivery?: unknown;
  appliesTo?: string;
  minSubtotalPkr?: unknown;
  maxRedemptions?: unknown;
  perPhone?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
};

function cleanOfferInput(input: OfferInput, existing?: OfferRecord) {
  const code = normalizeOfferCode(input.code ?? existing?.code);
  if (!/^[A-Z0-9][A-Z0-9-]{1,23}$/.test(code)) {
    throw new Error("Use 3–24 letters, numbers or hyphens for the offer code.");
  }
  const name = String(input.name ?? existing?.name ?? "").trim();
  if (name.length < 2 || name.length > 80) throw new Error("Enter a short offer name.");
  const status = String(input.status ?? existing?.status ?? "active");
  if (status !== "active" && status !== "off") throw new Error("Offer status must be active or off.");
  const discountType = String(input.discountType ?? existing?.discountType ?? "percent");
  if (discountType !== "percent" && discountType !== "fixed") {
    throw new Error("Discount type must be percent or fixed.");
  }
  const discountValue = wholeRupees(
    input.discountValue ?? existing?.discountValue ?? 0,
    "Discount value",
    true,
  );
  if (discountType === "percent" && discountValue > 100) {
    throw new Error("Percent off cannot be more than 100.");
  }
  const freeDelivery = Boolean(input.freeDelivery ?? existing?.freeDelivery);
  if (discountValue === 0 && !freeDelivery) {
    throw new Error("Choose a discount, free delivery, or both.");
  }
  const appliesTo = String(input.appliesTo ?? existing?.appliesTo ?? "all");
  if (appliesTo !== "all" && appliesTo !== "exclusive" && appliesTo !== "branded") {
    throw new Error("An offer can apply to all articles, HW Exclusive only, or Branded only.");
  }
  const minSubtotalPkr = optionalWholeRupees(
    input.minSubtotalPkr === undefined ? existing?.minSubtotalPkr : input.minSubtotalPkr,
    "Minimum subtotal",
  );
  const maxRedemptions = optionalWholeRupees(
    input.maxRedemptions === undefined ? existing?.maxRedemptions : input.maxRedemptions,
    "Maximum uses",
  );
  if (maxRedemptions === 0) throw new Error("Maximum uses must be blank or at least 1.");
  const perPhone = Boolean(input.perPhone ?? existing?.perPhone);
  const startsAt = optionalIsoDate(
    input.startsAt === undefined ? existing?.startsAt : input.startsAt,
    "Start date",
  );
  const endsAt = optionalIsoDate(
    input.endsAt === undefined ? existing?.endsAt : input.endsAt,
    "End date",
    true,
  );
  if (startsAt && endsAt && endsAt < startsAt) throw new Error("End date must be after the start date.");
  return {
    code,
    name,
    status,
    discountType,
    discountValue,
    freeDelivery: freeDelivery ? 1 : 0,
    appliesTo,
    minSubtotalPkr,
    maxRedemptions,
    perPhone: perPhone ? 1 : 0,
    startsAt,
    endsAt,
  };
}

async function listOffers(db: CatalogDatabase): Promise<OfferRecord[]> {
  const result = await db
    .prepare(`SELECT ${OFFER_SELECT} FROM offer_codes ORDER BY created_at DESC`)
    .all();
  return (result.results ?? []).map((row) => mapOfferRow(row));
}

async function getOffer(db: CatalogDatabase, id: string): Promise<OfferRecord | null> {
  if (!id) return null;
  const row = await db
    .prepare(`SELECT ${OFFER_SELECT} FROM offer_codes WHERE id = ?`)
    .bind(id)
    .first<Record<string, unknown>>();
  return row ? mapOfferRow(row) : null;
}

async function createOffer(db: CatalogDatabase, input: OfferInput) {
  const values = cleanOfferInput(input);
  const duplicate = await loadOfferByCode(db, values.code);
  if (duplicate) throw new Error("That offer code already exists.");
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  try {
    await db
      .prepare(
        `INSERT INTO offer_codes (
           id, code, name, status, discount_type, discount_value, free_delivery,
           applies_to, min_subtotal_pkr, max_redemptions, redemption_count, per_phone,
           starts_at, ends_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        values.code,
        values.name,
        values.status,
        values.discountType,
        values.discountValue,
        values.freeDelivery,
        values.appliesTo,
        values.minSubtotalPkr,
        values.maxRedemptions,
        values.perPhone,
        values.startsAt,
        values.endsAt,
        now,
        now,
      )
      .run();
    return getOffer(db, id);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (/UNIQUE constraint failed: offer_codes/i.test(detail)) {
      throw new Error("That offer code already exists.");
    }
    throw error;
  }
}

async function updateOffer(db: CatalogDatabase, input: OfferInput) {
  const current = await getOffer(db, String(input.id ?? ""));
  if (!current) throw new Error("Offer was not found.");
  const values = cleanOfferInput(input, current);
  if (values.code !== current.code) {
    const duplicate = await loadOfferByCode(db, values.code);
    if (duplicate) throw new Error("That offer code already exists.");
  }
  await db
    .prepare(
      `UPDATE offer_codes SET
         code = ?, name = ?, status = ?, discount_type = ?, discount_value = ?,
         free_delivery = ?, applies_to = ?, min_subtotal_pkr = ?, max_redemptions = ?,
         per_phone = ?, starts_at = ?, ends_at = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      values.code,
      values.name,
      values.status,
      values.discountType,
      values.discountValue,
      values.freeDelivery,
      values.appliesTo,
      values.minSubtotalPkr,
      values.maxRedemptions,
      values.perPhone,
      values.startsAt,
      values.endsAt,
      new Date().toISOString(),
      current.id,
    )
    .run();
  return getOffer(db, current.id);
}

type OrderInput = {
  checkoutToken?: string;
  name?: string;
  phone?: string;
  address?: string;
  city?: string;
  postal?: string;
  note?: string;
  offerCode?: string;
  items?: Array<{ id?: string; size?: string; quantity?: number }>;
};

type StockReservation = {
  statement: ReturnType<D1DatabaseLike["prepare"]>;
  restore: ReturnType<D1DatabaseLike["prepare"]>;
  manualPretId?: string;
};

async function refreshManualPretStock(db: CatalogDatabase, productId: string) {
  const result = await db
    .prepare("SELECT size AS title, stock_qty AS stockQty FROM manual_variant_stock WHERE product_id = ? ORDER BY size")
    .bind(productId)
    .all();
  const variants = (result.results ?? []).map((row) => ({
    title: String(row.title),
    stockQty: Number(row.stockQty),
    available: Number(row.stockQty) > 0,
  }));
  const total = variants.reduce((sum, variant) => sum + variant.stockQty, 0);
  await db
    .prepare("UPDATE manual_products SET variants_json = ?, stock_qty = ?, updated_at = ? WHERE id = ?")
    .bind(JSON.stringify(variants), total, new Date().toISOString(), productId)
    .run();
}

async function createOrder(db: CatalogDatabase, input: OrderInput) {
  const name = String(input.name ?? "").trim();
  const phone = String(input.phone ?? "").replace(/\s+/g, "");
  const address = String(input.address ?? "").trim();
  const city = String(input.city ?? "").trim();
  if (!name || !/^03\d{9}$/.test(phone) || !address || !city) {
    throw new Error("Enter a valid name, Pakistani mobile number, address and city.");
  }
  if (!Array.isArray(input.items) || !input.items.length) {
    throw new Error("Your bag is empty.");
  }
  const checkoutToken = String(input.checkoutToken ?? "").trim();
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(checkoutToken)) {
    throw new Error("Please refresh checkout and place your order again.");
  }
  const existingOrder = await db
    .prepare(
      `SELECT order_number AS number, customer_name AS name, city, phone,
              total_pkr AS total, payment_method AS payment, status
       FROM orders WHERE checkout_token = ?`,
    )
    .bind(checkoutToken)
    .first();
  if (existingOrder) return existingOrder;

  const catalog = await getPublishedArticles(db);
  const settings = await getStoreSettings(db);
  const priced = priceBagLines(catalog as Array<Record<string, unknown>>, input.items, settings);
  const reservations: StockReservation[] = [];
  const items = priced.map((line) => {
    const article = line.article;
    const { productId, size, quantity } = line;
    const garmentType = String(article.garmentType ?? "pret");
    const variants = Array.isArray(article.variants)
      ? article.variants as Array<{ title?: string; available?: boolean; stockQty?: number }>
      : [];

    if (String(article.inventorySource) === "manual") {
      if (garmentType === "pret") {
        const variant = variants.find((candidate) => candidate.title === size);
        if (!variant || !variant.available || Number(variant.stockQty ?? 0) < quantity) {
          throw new Error(`${article.title} is not available in size ${size} for this quantity.`);
        }
        reservations.push({
          statement: db.prepare(
            "UPDATE manual_variant_stock SET stock_qty = stock_qty - ? WHERE product_id = ? AND size = ? AND stock_qty >= ?",
          ).bind(quantity, productId, size, quantity),
          restore: db.prepare(
            "UPDATE manual_variant_stock SET stock_qty = stock_qty + ? WHERE product_id = ? AND size = ?",
          ).bind(quantity, productId, size),
          manualPretId: productId,
        });
      } else {
        if (Number(article.stockQty ?? 0) < quantity) {
          throw new Error(`${article.title} does not have enough stock.`);
        }
        reservations.push({
          statement: db.prepare(
            "UPDATE manual_products SET stock_qty = stock_qty - ?, updated_at = ? WHERE id = ? AND stock_qty >= ?",
          ).bind(quantity, new Date().toISOString(), productId, quantity),
          restore: db.prepare(
            "UPDATE manual_products SET stock_qty = stock_qty + ?, updated_at = ? WHERE id = ?",
          ).bind(quantity, new Date().toISOString(), productId),
        });
      }
    } else if (String(article.supplyMode) === "owned_stock") {
      if (Number(article.stockQty ?? 0) < quantity) {
        throw new Error(`${article.title} does not have enough stock.`);
      }
      reservations.push({
        statement: db.prepare(
          "UPDATE catalog_products SET stock_qty = stock_qty - ?, updated_at = ? WHERE id = ? AND stock_qty >= ?",
        ).bind(quantity, new Date().toISOString(), productId, quantity),
        restore: db.prepare(
          "UPDATE catalog_products SET stock_qty = stock_qty + ?, updated_at = ? WHERE id = ?",
        ).bind(quantity, new Date().toISOString(), productId),
      });
    }
    return {
      productId,
      title: line.title,
      size,
      quantity,
      unitPricePkr: line.unitPricePkr,
    };
  });
  const storeDeliveryPkr = settings.deliveryPkr;
  const requestedCode = normalizeOfferCode(input.offerCode);
  if (requestedCode && settings.saleActive && settings.salePercent > 0) {
    throw new Error(`${settings.saleName} is already applied and cannot be combined with an offer code.`);
  }
  let offer: OfferRecord | null = null;
  if (requestedCode) {
    offer = await loadOfferByCode(db, requestedCode);
    if (!offer) throw new Error("This code is not available.");
  }
  const quote = quoteFromOffer(priced, storeDeliveryPkr, offer);
  if (offer?.perPhone) {
    const used = await db
      .prepare("SELECT id FROM offer_redemptions WHERE offer_id = ? AND phone = ? LIMIT 1")
      .bind(offer.id, phone)
      .first();
    if (used) throw new Error("This code has already been used with this mobile number.");
  }
  const { subtotalPkr: subtotal, deliveryPkr: delivery, discountPkr, totalPkr: total, code: appliedCode } = quote;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const number = publicReference("HW");
  const orderInsert = db.prepare(
      `INSERT INTO orders (
         id, order_number, customer_name, phone, address, city, postal_code,
         note, subtotal_pkr, delivery_pkr, discount_pkr, offer_code, total_pkr,
         payment_method, status, checkout_token, stock_restored,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Cash on Delivery',
         'received', ?, 0, ?, ?)`,
    )
    .bind(
      id,
      number,
      name,
      phone,
      address,
      city,
      String(input.postal ?? "").trim() || null,
      String(input.note ?? "").trim() || null,
      subtotal,
      delivery,
      discountPkr,
      appliedCode,
      total,
      checkoutToken,
      now,
      now,
    );
  const itemInserts = items.map((item, index) =>
    db.prepare(
        `INSERT INTO order_items (
           id, order_id, product_id, title, size, quantity, unit_price_pkr
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        `${id}:${index}`,
        id,
        item.productId,
        item.title,
        item.size,
        item.quantity,
        item.unitPricePkr,
      ),
  );
  const offerStatements = offer
    ? [
        db.prepare(
          `UPDATE offer_codes
           SET redemption_count = redemption_count + 1
           WHERE id = ?
             AND status = 'active'
             AND (max_redemptions IS NULL OR redemption_count < max_redemptions)`,
        ).bind(offer.id),
        db.prepare(
          `INSERT INTO offer_redemptions (
             id, offer_id, order_id, phone, amount_saved_pkr, per_phone_lock, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          crypto.randomUUID(),
          offer.id,
          id,
          phone,
          discountPkr + (offer.freeDelivery ? storeDeliveryPkr : 0),
          offer.perPhone ? 1 : 0,
          now,
        ),
      ]
    : [];
  let batchResults: Array<{ meta?: { changes?: number } }>;
  try {
    batchResults = await db.batch([
      orderInsert,
      ...itemInserts,
      ...reservations.map((reservation) => reservation.statement),
      ...offerStatements,
    ]) as Array<{ meta?: { changes?: number } }>;
  } catch (error) {
    const duplicate = await db
      .prepare(
        `SELECT order_number AS number, customer_name AS name, city, phone,
                total_pkr AS total, payment_method AS payment, status
         FROM orders WHERE checkout_token = ?`,
      )
      .bind(checkoutToken)
      .first();
    if (duplicate) return duplicate;
    const detail = error instanceof Error ? error.message : String(error);
    if (/offer_redemptions_per_phone|UNIQUE constraint failed: offer_redemptions/i.test(detail)) {
      throw new Error("This code has already been used with this mobile number.");
    }
    throw error;
  }
  const reservationResults = batchResults.slice(1 + itemInserts.length, 1 + itemInserts.length + reservations.length);
  const failedReservation = reservationResults.findIndex((result) => Number(result?.meta?.changes ?? 0) !== 1);
  const offerIncrement = offer ? batchResults[1 + itemInserts.length + reservations.length] : null;
  async function undoOrder() {
    const successfulRestores = reservations
      .filter((_, index) => Number(reservationResults[index]?.meta?.changes ?? 0) === 1)
      .map((reservation) => reservation.restore);
    const incrementSucceeded = Boolean(offer && Number(offerIncrement?.meta?.changes ?? 0) === 1);
    await db.batch([
      ...successfulRestores,
      ...(incrementSucceeded && offer
        ? [
            db.prepare(
              "UPDATE offer_codes SET redemption_count = CASE WHEN redemption_count > 0 THEN redemption_count - 1 ELSE 0 END WHERE id = ?",
            ).bind(offer.id),
          ]
        : []),
      db.prepare("DELETE FROM offer_redemptions WHERE order_id = ?").bind(id),
      db.prepare("DELETE FROM order_items WHERE order_id = ?").bind(id),
      db.prepare("DELETE FROM orders WHERE id = ?").bind(id),
    ]);
  }
  if (failedReservation >= 0) {
    await undoOrder();
    throw new Error("One of the selected articles has just sold out. Please review your bag.");
  }
  if (offer && Number(offerIncrement?.meta?.changes ?? 0) !== 1) {
    await undoOrder();
    throw new Error("This code has reached its use limit.");
  }
  for (const productId of new Set(reservations.map((reservation) => reservation.manualPretId).filter(Boolean))) {
    await refreshManualPretStock(db, String(productId));
  }
  return {
    number,
    name,
    city,
    phone,
    total,
    payment: "Cash on Delivery",
    status: "received",
  };
}

async function getOrders(db: CatalogDatabase) {
  const result = await db
    .prepare(
      `SELECT
         id, order_number AS number, customer_name AS name, phone, address,
         city, postal_code AS postal, note, subtotal_pkr AS subtotal,
         delivery_pkr AS delivery, discount_pkr AS discount, offer_code AS offerCode,
         total_pkr AS total,
         payment_method AS payment, status,
         created_at AS createdAt, updated_at AS updatedAt
       FROM orders ORDER BY created_at DESC`,
    )
    .all();
  return result.results ?? [];
}

async function getOrderDetail(db: CatalogDatabase, id: string) {
  if (!id) return null;
  const order = await db
    .prepare(
      `SELECT
         id, order_number AS number, customer_name AS name, phone, address,
         city, postal_code AS postal, note, subtotal_pkr AS subtotal,
         delivery_pkr AS delivery, discount_pkr AS discount, offer_code AS offerCode,
         total_pkr AS total,
         payment_method AS payment, status,
         created_at AS createdAt, updated_at AS updatedAt
       FROM orders WHERE id = ?`,
    )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!order) return null;
  const itemResult = await db
    .prepare(
      `SELECT id, product_id AS productId, title, size, quantity,
              unit_price_pkr AS unitPricePkr
       FROM order_items WHERE order_id = ? ORDER BY id ASC`,
    )
    .bind(id)
    .all();
  return { ...order, items: itemResult.results ?? [] };
}

async function trackOrder(db: CatalogDatabase, number: string, phone: string) {
  return db
    .prepare(
      `SELECT order_number AS number, city, total_pkr AS total, status,
              created_at AS createdAt, updated_at AS updatedAt
       FROM orders WHERE upper(order_number) = upper(?) AND phone = ?`,
    )
    .bind(number.trim(), phone.replace(/\s+/g, ""))
    .first();
}

async function updateOrderStatus(
  db: CatalogDatabase,
  id: string,
  status: string,
) {
  const allowed = new Set(["received", "confirmed", "packed", "dispatched", "delivered", "cancelled"]);
  if (!id || !allowed.has(status)) throw new Error("Choose a valid order status.");
  const current = await db
    .prepare("SELECT status, stock_restored AS stockRestored FROM orders WHERE id = ?")
    .bind(id)
    .first<{ status: string; stockRestored: number }>();
  if (!current) throw new Error("Order was not found.");
  if (current.status === "cancelled" && status !== "cancelled") {
    throw new Error("A cancelled order cannot be reopened. Create a new order if needed.");
  }
  if (status === "cancelled" && !Boolean(current.stockRestored)) {
    const itemResult = await db
      .prepare("SELECT product_id AS productId, size, quantity FROM order_items WHERE order_id = ?")
      .bind(id)
      .all();
    const restores: Array<ReturnType<D1DatabaseLike["prepare"]>> = [];
    const pretIds = new Set<string>();
    for (const row of itemResult.results ?? []) {
      const productId = String(row.productId);
      const quantity = Number(row.quantity);
      const product = await db
        .prepare("SELECT garment_type AS garmentType FROM manual_products WHERE id = ?")
        .bind(productId)
        .first<{ garmentType: string }>();
      if (product) {
        if (product?.garmentType === "pret") {
          restores.push(db.prepare(
            "UPDATE manual_variant_stock SET stock_qty = stock_qty + ? WHERE product_id = ? AND size = ?",
          ).bind(quantity, productId, String(row.size)));
          pretIds.add(productId);
        } else {
          restores.push(db.prepare(
            "UPDATE manual_products SET stock_qty = stock_qty + ?, updated_at = ? WHERE id = ?",
          ).bind(quantity, new Date().toISOString(), productId));
        }
      } else {
        const imported = await db
          .prepare("SELECT supply_mode AS supplyMode FROM catalog_products WHERE id = ?")
          .bind(productId)
          .first<{ supplyMode: string }>();
        if (imported?.supplyMode === "owned_stock") {
          restores.push(db.prepare(
            "UPDATE catalog_products SET stock_qty = stock_qty + ?, updated_at = ? WHERE id = ?",
          ).bind(quantity, new Date().toISOString(), productId));
        }
      }
    }
    await db.batch([
      ...restores,
      db.prepare("UPDATE orders SET status = 'cancelled', stock_restored = 1, updated_at = ? WHERE id = ? AND stock_restored = 0")
        .bind(new Date().toISOString(), id),
    ]);
    for (const productId of pretIds) await refreshManualPretStock(db, productId);
    return getOrders(db);
  }
  await db
    .prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?")
    .bind(status, new Date().toISOString(), id)
    .run();
  return getOrders(db);
}

async function deleteOrder(db: CatalogDatabase, id: string) {
  if (!id) throw new Error("Choose an order to delete.");
  const order = await db
    .prepare("SELECT status FROM orders WHERE id = ?")
    .bind(id)
    .first<{ status: string }>();
  if (!order) throw new Error("Order was not found.");
  if (order.status !== "cancelled") {
    throw new Error("Cancel this order before deleting it so reserved stock is restored safely.");
  }
  const redemption = await db
    .prepare("SELECT offer_id AS offerId FROM offer_redemptions WHERE order_id = ? LIMIT 1")
    .bind(id)
    .first<{ offerId: string }>();
  await db.batch([
    db.prepare("DELETE FROM offer_redemptions WHERE order_id = ?").bind(id),
    ...(redemption?.offerId
      ? [db.prepare(
          "UPDATE offer_codes SET redemption_count = CASE WHEN redemption_count > 0 THEN redemption_count - 1 ELSE 0 END WHERE id = ?",
        ).bind(redemption.offerId)]
      : []),
    db.prepare("DELETE FROM order_items WHERE order_id = ?").bind(id),
    db.prepare("DELETE FROM orders WHERE id = ? AND status = 'cancelled'").bind(id),
  ]);
  return getOrders(db);
}

type CustomerRequestInput = {
  type?: string;
  orderNumber?: string;
  name?: string;
  phone?: string;
  email?: string;
  articleName?: string;
  reason?: string;
  details?: string;
};

async function createCustomerRequest(db: CatalogDatabase, input: CustomerRequestInput) {
  const type = ["exchange", "return", "complaint", "question"].includes(String(input.type))
    ? String(input.type)
    : "question";
  const name = String(input.name ?? "").trim();
  const phone = String(input.phone ?? "").replace(/\s+/g, "");
  const reason = String(input.reason ?? "").trim();
  const details = String(input.details ?? "").trim();
  if (!name || !/^03\d{9}$/.test(phone) || !reason || !details) {
    throw new Error("Enter your name, valid Pakistani mobile number, reason and details.");
  }
  const id = crypto.randomUUID();
  const number = publicReference("HWR");
  const now = new Date().toISOString();
  const orderNumber = String(input.orderNumber ?? "").trim().toUpperCase() || null;
  await db.prepare(
    `INSERT INTO customer_requests (
       id, request_number, type, order_number, customer_name, phone, email,
       article_name, reason, details, status, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', ?, ?)`,
  ).bind(
    id,
    number,
    type,
    orderNumber,
    name,
    phone,
    String(input.email ?? "").trim() || null,
    String(input.articleName ?? "").trim() || null,
    reason,
    details,
    now,
    now,
  ).run();
  return { number, type, status: "received" };
}

async function getCustomerRequests(db: CatalogDatabase, id?: string) {
  const result = await db.prepare(
    `SELECT id, request_number AS number, type, order_number AS orderNumber,
            customer_name AS name, phone, email, article_name AS articleName,
            reason, details, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM customer_requests ${id ? "WHERE id = ?" : ""}
     ORDER BY created_at DESC`,
  );
  if (id) return result.bind(id).first();
  return (await result.all()).results ?? [];
}

async function updateCustomerRequest(db: CatalogDatabase, id: string, status: string) {
  const allowed = new Set(["received", "contacted", "approved", "resolved", "rejected"]);
  if (!id || !allowed.has(status)) throw new Error("Choose a valid request status.");
  await db.prepare("UPDATE customer_requests SET status = ?, updated_at = ? WHERE id = ?")
    .bind(status, new Date().toISOString(), id)
    .run();
  return getCustomerRequests(db);
}

async function deleteCustomerRequest(db: CatalogDatabase, id: string) {
  if (!id) throw new Error("Choose a customer request to delete.");
  const existing = await db
    .prepare("SELECT id FROM customer_requests WHERE id = ?")
    .bind(id)
    .first();
  if (!existing) throw new Error("Customer request was not found.");
  await db.prepare("DELETE FROM customer_requests WHERE id = ?").bind(id).run();
  return getCustomerRequests(db);
}

type ProductReviewInput = {
  productId?: string;
  name?: string;
  rating?: number;
  title?: string;
  comment?: string;
  website?: string;
};

async function readProductReviewSubmission(request: Request): Promise<{ input: ProductReviewInput; image: File | null }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return { input: await request.json() as ProductReviewInput, image: null };
  }
  const data = await request.formData();
  const imageValue = data.get("image");
  return {
    input: {
      productId: String(data.get("productId") ?? ""),
      name: String(data.get("name") ?? ""),
      rating: Number(data.get("rating")),
      title: String(data.get("title") ?? ""),
      comment: String(data.get("comment") ?? ""),
      website: String(data.get("website") ?? ""),
    },
    image: imageValue instanceof File && imageValue.size > 0 ? imageValue : null,
  };
}

async function validatedReviewImage(image: File | null) {
  if (!image) return null;
  if (image.size < 12 || image.size > MAX_REVIEW_IMAGE_BYTES) {
    throw new Error("The review photo must be smaller than 600 KB after optimization.");
  }
  const signature = new Uint8Array(await image.slice(0, 12).arrayBuffer());
  const format = detectedArticleImageType(signature);
  if (!format) throw new Error("The review photo must contain valid JPG, PNG or WebP image data.");
  return { image, ...format };
}

async function reviewSubmitterHash(request: Request): Promise<string> {
  const address = request.headers.get("CF-Connecting-IP") ?? "local";
  return bytesToHex(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`haley-wali-review:${address}`),
  ));
}

async function getPublishedReviews(db: CatalogDatabase, productId: string) {
  if (!productId) return { reviews: [], count: 0, average: 0 };
  const [result, summary] = await Promise.all([
    db.prepare(
      `SELECT id, customer_name AS name, rating, title, comment, image_url AS imageUrl, created_at AS createdAt
       FROM product_reviews
       WHERE product_id = ? AND status = 'approved'
       ORDER BY created_at DESC LIMIT 50`,
    ).bind(productId).all(),
    db.prepare(
      `SELECT COUNT(*) AS count, ROUND(AVG(rating), 1) AS average
       FROM product_reviews
       WHERE product_id = ? AND status = 'approved'`,
    ).bind(productId).first<{ count: number; average: number | null }>(),
  ]);
  const reviews = result.results ?? [];
  return {
    reviews,
    count: Number(summary?.count ?? 0),
    average: Number(summary?.average ?? 0),
  };
}

async function getLatestPublishedReviews(db: CatalogDatabase, requestedLimit: number) {
  const limit = Math.min(12, Math.max(1, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 6));
  const result = await db.prepare(
    `SELECT
       pr.id,
       pr.product_id AS productId,
       pr.customer_name AS name,
       pr.rating,
       pr.title,
       pr.comment,
       pr.image_url AS imageUrl,
       pr.created_at AS createdAt,
       COALESCE(mp.public_title, cp.public_title) AS articleName,
       COALESCE(mp.image_url, sp.image_url) AS articleImageUrl
     FROM product_reviews pr
     LEFT JOIN manual_products mp ON mp.id = pr.product_id
     LEFT JOIN catalog_products cp ON cp.id = pr.product_id
     LEFT JOIN supplier_products sp ON sp.id = cp.supplier_product_id
     WHERE pr.status = 'approved'
       AND (
         (mp.id IS NOT NULL AND mp.publish_status = 'published' AND mp.selling_price_pkr IS NOT NULL)
         OR
         (cp.id IS NOT NULL AND cp.publish_status = 'published' AND cp.selling_price_pkr IS NOT NULL)
       )
     ORDER BY pr.created_at DESC
     LIMIT ?`,
  ).bind(limit).all();
  return { reviews: result.results ?? [] };
}

async function createProductReview(
  db: CatalogDatabase,
  request: Request,
  input: ProductReviewInput,
  env: Env,
  submittedImage: File | null,
) {
  if (String(input.website ?? "").trim()) return { submitted: true };
  const productId = String(input.productId ?? "").trim();
  const name = String(input.name ?? "").trim().slice(0, 60);
  const rating = Number(input.rating);
  const title = String(input.title ?? "").trim().slice(0, 90);
  const comment = String(input.comment ?? "").trim().slice(0, 1000);
  if (!productId || name.length < 2 || !Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length < 10) {
    throw new Error("Enter your name, choose a rating and write at least 10 characters.");
  }
  const product = await db.prepare(
    `SELECT id FROM manual_products WHERE id = ? AND publish_status = 'published'
     UNION ALL
     SELECT id FROM catalog_products WHERE id = ? AND publish_status = 'published'
     LIMIT 1`,
  ).bind(productId, productId).first();
  if (!product) throw new Error("This article is not available for reviews.");
  const submitterHash = await reviewSubmitterHash(request);
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await db.prepare(
    "SELECT count(*) AS count FROM product_reviews WHERE submitter_hash = ? AND created_at >= ?",
  ).bind(submitterHash, cutoff).first<{ count: number }>();
  if (Number(recent?.count ?? 0) >= 5) {
    throw new Error("Too many reviews were submitted recently. Please try again later.");
  }
  const validatedImage = await validatedReviewImage(submittedImage);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  let imageUrl: string | null = null;
  if (validatedImage) {
    const supabase = supabaseStorageConfig(env);
    if (!supabase) throw new Error("Photo storage is temporarily unavailable. Submit without a photo or try again later.");
    const date = new Date();
    const key = `reviews/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${validatedImage.extension}`;
    await uploadSupabaseImage(supabase, key, validatedImage.image, validatedImage.contentType);
    imageUrl = supabasePublicImageUrl(supabase, key);
  }
  try {
    await db.prepare(
      `INSERT INTO product_reviews
         (id, product_id, customer_name, rating, title, comment, image_url, status, submitter_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    ).bind(id, productId, name, rating, title, comment, imageUrl, submitterHash, now, now).run();
  } catch (error) {
    if (imageUrl) await deleteUnreferencedArticleImages(db, env, [imageUrl]);
    throw error;
  }
  return { submitted: true, status: "pending" };
}

async function getAdminReviews(db: CatalogDatabase, id?: string) {
  const query = db.prepare(
    `SELECT id, product_id AS productId, customer_name AS name, rating, title,
            comment, image_url AS imageUrl, status, created_at AS createdAt, updated_at AS updatedAt
     FROM product_reviews ${id ? "WHERE id = ?" : ""}
     ORDER BY created_at DESC`,
  );
  if (id) return query.bind(id).first();
  return (await query.all()).results ?? [];
}

async function updateProductReview(db: CatalogDatabase, id: string, status: string) {
  if (!id || !new Set(["pending", "approved", "rejected"]).has(status)) {
    throw new Error("Choose a valid review status.");
  }
  await db.prepare("UPDATE product_reviews SET status = ?, updated_at = ? WHERE id = ?")
    .bind(status, new Date().toISOString(), id).run();
  return getAdminReviews(db);
}

async function deleteProductReview(db: CatalogDatabase, env: Env, id: string) {
  if (!id) throw new Error("Review was not found.");
  const review = await db.prepare("SELECT image_url AS imageUrl FROM product_reviews WHERE id = ?")
    .bind(id).first() as { imageUrl?: string | null } | null;
  await db.prepare("DELETE FROM product_reviews WHERE id = ?").bind(id).run();
  if (review?.imageUrl) await deleteUnreferencedArticleImages(db, env, [review.imageUrl]);
  return getAdminReviews(db);
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const applicationWorker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (!isAllowedManagerHostname(url.hostname)) {
      return new Response("Not found", { status: 404 });
    }

    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      const headers = url.pathname.startsWith("/api/admin/")
        ? (request.headers.get("origin") === url.origin ? { "access-control-allow-origin": url.origin } : {})
        : publicCorsHeaders(request, env);
      return Object.keys(headers).length
        ? new Response(null, { status: 204, headers })
        : new Response(null, { status: 403 });
    }

    if (url.pathname === "/api/admin/session") {
      if (request.method === "GET") {
        return jsonResponse({ authenticated: await validAdminSession(request, env) });
      }
      if (request.method === "DELETE") {
        if (!isSameOriginWrite(request)) {
          return jsonResponse({ error: "Request origin is not allowed." }, { status: 403 });
        }
        return jsonResponse(
          { authenticated: false },
          { headers: { "set-cookie": adminCookie("", 0, request) } },
        );
      }
      if (request.method === "POST") {
        if (!isSameOriginWrite(request)) {
          return jsonResponse({ error: "Request origin is not allowed." }, { status: 403 });
        }
        if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
          return jsonResponse({ error: "Sign-in requires JSON." }, { status: 415 });
        }
        const declaredLength = Number(request.headers.get("content-length") ?? "0");
        if (!Number.isFinite(declaredLength) || declaredLength > 2048) {
          return jsonResponse({ error: "Sign-in request is too large." }, { status: 413 });
        }
        if (!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) {
          return jsonResponse({ error: "Store Manager sign-in is not configured." }, { status: 503 });
        }
        await ensureCatalogSchema(env.DB);
        const ipHash = await loginClientHash(request);
        if (!(await loginAllowed(env.DB, ipHash))) {
          return jsonResponse(
            { error: "Too many sign-in attempts. Try again in 15 minutes." },
            { status: 429, headers: { "retry-after": "900" } },
          );
        }
        const rawInput = await request.text();
        if (rawInput.length > 2048) {
          return jsonResponse({ error: "Sign-in request is too large." }, { status: 413 });
        }
        let input: { password?: string };
        try {
          input = JSON.parse(rawInput) as { password?: string };
        } catch {
          return jsonResponse({ error: "Sign-in request is invalid." }, { status: 400 });
        }
        if (!(await verifyPassword(String(input.password ?? ""), env.ADMIN_PASSWORD))) {
          await recordLoginFailure(env.DB, ipHash);
          return jsonResponse({ error: "Incorrect password." }, { status: 401 });
        }
        await clearLoginFailures(env.DB, ipHash);
        const expires = String(Date.now() + 8 * 60 * 60 * 1000);
        const token = `${expires}.${await signSession(expires, env.ADMIN_SESSION_SECRET)}`;
        return jsonResponse(
          { authenticated: true },
          { headers: { "set-cookie": adminCookie(token, 8 * 60 * 60, request) } },
        );
      }
    }

    if (url.pathname.startsWith("/api/admin/")) {
      if (!isSameOriginWrite(request)) {
        return jsonResponse({ error: "Request origin is not allowed." }, { status: 403 });
      }
      if (!(await validAdminSession(request, env))) {
        return jsonResponse({ error: "Store Manager sign-in required." }, { status: 401 });
      }
    }

    if (
      request.method === "GET" &&
      (url.pathname === "/api/catalog/articles" ||
        url.pathname === "/api/catalog/pret")
    ) {
      const loadProducts = async () => ({
        products: url.pathname === "/api/catalog/pret"
          ? await getPublishedPret(env.DB)
          : await getPublishedArticles(env.DB),
        settings: await getStoreSettings(env.DB),
      });
      // The production database is already migrated. Read it immediately so a
      // new Worker isolate does not perform the full schema bootstrap before a
      // visitor can see published articles. A genuinely new/old database still
      // self-prepares and retries once.
      const loaded = await loadProducts().catch(async () => {
        await prepareCatalog(env.DB);
        return loadProducts();
      });
      const publicProducts = loaded.products.map((product) => {
        const article = { ...product } as typeof product & { inventorySource?: string };
        delete article.inventorySource;
        if (article.collection === "branded") {
          const canonicalBrand = approvedArticleBrand(article.brand)?.name;
          if (canonicalBrand) article.brand = canonicalBrand === "Other Brands" ? "Branded" : canonicalBrand;
        }
        const originalPricePkr = Number(article.pricePkr ?? 0);
        const salePricePkr = applySeasonSalePrice(originalPricePkr, loaded.settings);
        if (salePricePkr < originalPricePkr) {
          Object.assign(article, {
            originalPricePkr,
            pricePkr: salePricePkr,
            salePercent: loaded.settings.salePercent,
            saleName: loaded.settings.saleName,
          });
        }
        return article;
      });
      return jsonResponse(
        { products: publicProducts },
        {
          headers: {
            ...publicCorsHeaders(request, env),
            "cache-control": "public, max-age=10, s-maxage=30",
          },
        },
      );
    }

    if (request.method === "GET" && url.pathname === "/api/shop/settings") {
      await prepareCatalog(env.DB);
      return jsonResponse(await getStoreSettings(env.DB), {
        headers: {
          ...publicCorsHeaders(request, env),
          "cache-control": "public, max-age=30, s-maxage=60",
        },
      });
    }

    if (request.method === "POST" && url.pathname === "/api/offers/preview") {
      try {
        await prepareCatalog(env.DB);
        const input = (await request.json()) as {
          items?: Array<{ id?: string; size?: string; quantity?: number }>;
          code?: string;
          phone?: string;
        };
        const quote = await quoteBag(env.DB, input);
        return jsonResponse(
          {
            code: quote.code,
            discountPkr: quote.discountPkr,
            deliveryPkr: quote.deliveryPkr,
            subtotalPkr: quote.subtotalPkr,
            totalPkr: quote.totalPkr,
            label: quote.label,
          },
          { headers: publicCorsHeaders(request, env) },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: message }, { status: 400, headers: publicCorsHeaders(request, env) });
      }
    }

    if (
      request.method === "GET" &&
      (url.pathname === "/api/admin/catalog/imported" ||
        url.pathname === "/api/admin/catalog/pret")
    ) {
      await prepareCatalog(env.DB);
      return jsonResponse({ products: await getAdminPret(env.DB) });
    }

    if (
      request.method === "PATCH" &&
      (url.pathname === "/api/admin/catalog/imported" ||
        url.pathname === "/api/admin/catalog/pret")
    ) {
      try {
        await prepareCatalog(env.DB);
        const input = (await request.json()) as CatalogUpdate;
        if (input.action === "publish") {
          if (input.supplyMode !== "owned_stock") {
            throw new Error("Choose Already in Haley Wali stock and enter stock by size before publishing.");
          }
          return jsonResponse(await promoteImportedProduct(env.DB, input));
        }
        const products = await updateAdminPret(env.DB, input);
        return jsonResponse({ products });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: message }, { status: 400 });
      }
    }

    if (
      request.method === "DELETE" &&
      url.pathname === "/api/admin/catalog/imported"
    ) {
      try {
        await prepareCatalog(env.DB);
        return jsonResponse({
          products: await archiveImportedProduct(
            env.DB,
            url.searchParams.get("id") ?? "",
          ),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: message }, { status: 400 });
      }
    }

    if (
      request.method === "POST" &&
      url.pathname === "/api/admin/import/supplier"
    ) {
      try {
        await prepareCatalog(env.DB);
        const repository = new D1CatalogRepository(
          env.DB as unknown as D1DatabaseLike,
        );
        const sync = await runSupplierSync({ repository });
        return jsonResponse({
          sync,
          products: await getAdminPret(env.DB),
          importedAt: new Date().toISOString(),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: message }, { status: 502 });
      }
    }

    if (
      request.method === "GET" &&
      url.pathname === "/api/admin/articles"
    ) {
      await prepareCatalog(env.DB);
      return jsonResponse({ products: await getManualProducts(env.DB) });
    }

    if (request.method === "GET" && url.pathname === "/api/admin/brands") {
      await prepareCatalog(env.DB);
      return jsonResponse({
        brands: await getApprovedArticleBrands(env.DB),
      });
    }

    if (request.method === "POST" && url.pathname === "/api/admin/brands/suggest") {
      try {
        const input = await request.json() as { name?: string };
        return jsonResponse({ suggestions: await suggestApprovedBrands(env, input.name) });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: message }, { status: 400 });
      }
    }

    if (request.method === "POST" && url.pathname === "/api/admin/brands/approve") {
      try {
        await prepareCatalog(env.DB);
        const input = await request.json() as { name?: string };
        const name = await approveSuggestedBrand(env.DB, input.name);
        return jsonResponse({ name, brands: await getApprovedArticleBrands(env.DB) });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: message }, { status: 400 });
      }
    }

    if (request.method === "POST" && url.pathname === "/api/admin/article-images") {
      try {
        await prepareCatalog(env.DB);
        return await uploadArticleImages(request, env);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: message }, { status: 400 });
      }
    }

    if (request.method === "DELETE" && url.pathname === "/api/admin/article-images") {
      try {
        await prepareCatalog(env.DB);
        const input = await request.json() as { url?: string };
        await deleteUnreferencedArticleImages(env.DB, env, [input.url]);
        return jsonResponse({ deleted: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: message }, { status: 400 });
      }
    }

    if (
      request.method === "POST" &&
      url.pathname === "/api/admin/articles"
    ) {
      try {
        await prepareCatalog(env.DB);
        const input = (await request.json()) as ManualProductInput;
        return jsonResponse(
          { products: await createManualProduct(env.DB, input) },
          { status: 201 },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: message }, { status: 400 });
      }
    }

    if (
      request.method === "PATCH" &&
      url.pathname === "/api/admin/articles"
    ) {
      try {
        await prepareCatalog(env.DB);
        const input = (await request.json()) as ManualProductInput;
        return jsonResponse({
          products: await updateManualProduct(env.DB, env, input),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: message }, { status: 400 });
      }
    }

    if (
      request.method === "DELETE" &&
      url.pathname === "/api/admin/articles"
    ) {
      try {
        await prepareCatalog(env.DB);
        return jsonResponse({
          products: await removeManualProduct(
            env.DB,
            env,
            url.searchParams.get("id") ?? "",
          ),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: message }, { status: 400 });
      }
    }

    if (request.method === "POST" && url.pathname === "/api/orders") {
      try {
        await prepareCatalog(env.DB);
        const input = (await request.json()) as OrderInput;
        return jsonResponse(
          { order: await createOrder(env.DB, input) },
          { status: 201, headers: publicCorsHeaders(request, env) },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: message }, { status: 400, headers: publicCorsHeaders(request, env) });
      }
    }

    if (request.method === "POST" && url.pathname === "/api/support/requests") {
      try {
        await prepareCatalog(env.DB);
        const input = await request.json() as CustomerRequestInput;
        return jsonResponse(
          { request: await createCustomerRequest(env.DB, input) },
          { status: 201, headers: publicCorsHeaders(request, env) },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: message }, { status: 400, headers: publicCorsHeaders(request, env) });
      }
    }

    if (request.method === "GET" && url.pathname === "/api/reviews") {
      await prepareCatalog(env.DB);
      if (url.searchParams.get("latest") === "1") {
        return jsonResponse(
          await getLatestPublishedReviews(env.DB, Number(url.searchParams.get("limit") ?? 6)),
          { headers: { ...publicCorsHeaders(request, env), "cache-control": "public, max-age=10, s-maxage=30" } },
        );
      }
      return jsonResponse(
        await getPublishedReviews(env.DB, url.searchParams.get("productId") ?? ""),
        { headers: { ...publicCorsHeaders(request, env), "cache-control": "public, max-age=10, s-maxage=30" } },
      );
    }

    if (request.method === "POST" && url.pathname === "/api/reviews") {
      try {
        const contentLength = Number(request.headers.get("content-length") ?? 0);
        if (contentLength > MAX_REVIEW_SUBMISSION_BYTES) {
          return jsonResponse({ error: "The optimized review photo is too large." }, { status: 413, headers: publicCorsHeaders(request, env) });
        }
        await prepareCatalog(env.DB);
        const { input, image } = await readProductReviewSubmission(request);
        return jsonResponse(
          await createProductReview(env.DB, request, input, env, image),
          { status: 201, headers: publicCorsHeaders(request, env) },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: message }, { status: 400, headers: publicCorsHeaders(request, env) });
      }
    }

    if (request.method === "GET" && url.pathname === "/api/orders/track") {
      await prepareCatalog(env.DB);
      const order = await trackOrder(
        env.DB,
        url.searchParams.get("number") ?? "",
        url.searchParams.get("phone") ?? "",
      );
      return order
        ? jsonResponse({ order }, { headers: publicCorsHeaders(request, env) })
        : jsonResponse({ error: "Order was not found." }, { status: 404, headers: publicCorsHeaders(request, env) });
    }

    if (request.method === "GET" && url.pathname === "/api/admin/settings") {
      await prepareCatalog(env.DB);
      return jsonResponse(await getStoreSettings(env.DB));
    }

    if (request.method === "PATCH" && url.pathname === "/api/admin/settings") {
      try {
        await prepareCatalog(env.DB);
        const input = (await request.json()) as {
          deliveryPkr?: unknown;
          saleActive?: unknown;
          salePercent?: unknown;
          saleName?: unknown;
          saleDescription?: unknown;
        };
        return jsonResponse(await updateStoreSettings(env.DB, input));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: message }, { status: 400 });
      }
    }

    if (request.method === "GET" && url.pathname === "/api/admin/offers") {
      await prepareCatalog(env.DB);
      const id = url.searchParams.get("id") || undefined;
      if (id) {
        const offer = await getOffer(env.DB, id);
        return offer
          ? jsonResponse({ offer: publicOffer(offer) })
          : jsonResponse({ error: "Offer was not found." }, { status: 404 });
      }
      return jsonResponse({ offers: (await listOffers(env.DB)).map(publicOffer) });
    }

    if (request.method === "POST" && url.pathname === "/api/admin/offers") {
      try {
        await prepareCatalog(env.DB);
        const offer = await createOffer(env.DB, await request.json() as OfferInput);
        return jsonResponse({ offer: offer ? publicOffer(offer) : null }, { status: 201 });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: message }, { status: 400 });
      }
    }

    if (request.method === "PATCH" && url.pathname === "/api/admin/offers") {
      try {
        await prepareCatalog(env.DB);
        const offer = await updateOffer(env.DB, await request.json() as OfferInput);
        return jsonResponse({ offer: offer ? publicOffer(offer) : null });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: message }, { status: 400 });
      }
    }

    if (request.method === "GET" && url.pathname === "/api/admin/orders") {
      await prepareCatalog(env.DB);
      const id = url.searchParams.get("id");
      if (id) {
        const order = await getOrderDetail(env.DB, id);
        return order
          ? jsonResponse({ order })
          : jsonResponse({ error: "Order was not found." }, { status: 404 });
      }
      return jsonResponse({ orders: await getOrders(env.DB) });
    }

    if (request.method === "PATCH" && url.pathname === "/api/admin/orders") {
      try {
        await prepareCatalog(env.DB);
        const input = (await request.json()) as { id?: string; status?: string };
        return jsonResponse({
          orders: await updateOrderStatus(
            env.DB,
            String(input.id ?? ""),
            String(input.status ?? ""),
          ),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: message }, { status: 400 });
      }
    }

    if (request.method === "DELETE" && url.pathname === "/api/admin/orders") {
      try {
        await prepareCatalog(env.DB);
        return jsonResponse({ orders: await deleteOrder(env.DB, url.searchParams.get("id") ?? "") });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: message }, { status: 400 });
      }
    }

    if (request.method === "GET" && url.pathname === "/api/admin/requests") {
      await prepareCatalog(env.DB);
      const id = url.searchParams.get("id") || undefined;
      const result = await getCustomerRequests(env.DB, id);
      return id
        ? (result ? jsonResponse({ request: result }) : jsonResponse({ error: "Request was not found." }, { status: 404 }))
        : jsonResponse({ requests: result });
    }

    if (request.method === "PATCH" && url.pathname === "/api/admin/requests") {
      try {
        await prepareCatalog(env.DB);
        const input = await request.json() as { id?: string; status?: string };
        return jsonResponse({ requests: await updateCustomerRequest(env.DB, String(input.id ?? ""), String(input.status ?? "")) });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: message }, { status: 400 });
      }
    }

    if (request.method === "DELETE" && url.pathname === "/api/admin/requests") {
      try {
        await prepareCatalog(env.DB);
        return jsonResponse({ requests: await deleteCustomerRequest(env.DB, url.searchParams.get("id") ?? "") });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: message }, { status: 400 });
      }
    }

    if (request.method === "GET" && url.pathname === "/api/admin/reviews") {
      await prepareCatalog(env.DB);
      const id = url.searchParams.get("id") || undefined;
      const result = await getAdminReviews(env.DB, id);
      return id
        ? (result ? jsonResponse({ review: result }) : jsonResponse({ error: "Review was not found." }, { status: 404 }))
        : jsonResponse({ reviews: result });
    }

    if (request.method === "PATCH" && url.pathname === "/api/admin/reviews") {
      try {
        await prepareCatalog(env.DB);
        const input = await request.json() as { id?: string; status?: string };
        return jsonResponse({ reviews: await updateProductReview(env.DB, String(input.id ?? ""), String(input.status ?? "")) });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: message }, { status: 400 });
      }
    }

    if (request.method === "DELETE" && url.pathname === "/api/admin/reviews") {
      try {
        await prepareCatalog(env.DB);
        return jsonResponse({ reviews: await deleteProductReview(env.DB, env, url.searchParams.get("id") ?? "") });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: message }, { status: 400 });
      }
    }

    const acceptsHtml = request.method === "GET" && (request.headers.get("accept") ?? "").includes("text/html");
    if (acceptsHtml && url.pathname !== "/signin" && !(await validAdminSession(request, env))) {
      return Response.redirect(new URL(`/signin?returnTo=${encodeURIComponent(url.pathname + url.search)}`, url), 302);
    }

    return handler.fetch(request, env, ctx);
  },
  async scheduled(
    _event: unknown,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const repository = new D1CatalogRepository(
      env.DB as unknown as D1DatabaseLike,
    );
    ctx.waitUntil(runSupplierSync({ repository }));
  },
};

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const response = await applicationWorker.fetch(request, env, ctx);
    const url = new URL(request.url);
    const isManagerResponse = url.pathname.startsWith("/api/admin/") ||
      (request.headers.get("accept") ?? "").includes("text/html");
    return isManagerResponse ? withManagerSecurityHeaders(response) : response;
  },
  scheduled(event: unknown, env: Env, ctx: ExecutionContext): Promise<void> {
    return applicationWorker.scheduled(event, env, ctx);
  },
};

export default worker;
