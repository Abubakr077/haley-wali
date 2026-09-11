# Architecture

## System shape

```text
Customer browser
    |
    v
Astro storefront + small React islands
    |
    | PUBLIC_CATALOG_API_BASE
    v
Cloudflare Worker / API + React store manager
    |                    |
    v                    v
Cloudflare D1 (catalog, stock, orders and reviews)

Cloudflare Workers AI (button-triggered brand normalization only)

Supabase Storage public bucket (optimized article images)

Supplier Shopify JSON feed
    |
    v
TypeScript import module -> private imported drafts in D1
```

## Applications and responsibilities

### Public storefront — `apps/storefront/`

- Astro 5 renders the public pages.
- React 19 is used only for interactive areas: live catalog/filtering, article
  selection, bag, checkout, order tracking and customer forms.
- Cloudflare adapter is used for the deploy build.
- Local URL is normally `http://127.0.0.1:4321`.
- Public pages include home, shop, search, product, bag, checkout, success,
  tracking, contact, delivery, exchange, about and 404. Pret measurements live
  on each article page rather than on a shared size-guide route.

### Store manager and API — root `app/` and `worker/`

- The internal manager is a React/Next-style app built through vinext.
- It uses a persistent left navigation and separate routes: `/` for Overview,
  `/articles`, `/imports`, and `/orders`.
- Article and import management use list-to-detail routes. `/articles/new`
  creates an article, `/articles/[id]` edits one manual article, and
  `/imports/[id]` prices and publishes one imported article.
- Orders also use list-to-detail navigation: `/orders` is the queue and
  `/orders/[id]` shows one customer's address, articles, totals and status.
- `app/AdminShell.tsx` owns the shared desktop sidebar and mobile menu.
- `app/CatalogManager.tsx` supplies the data and controls for each manager page.
- `worker/index.ts` owns JSON APIs, D1 access, order creation, authenticated
  Supabase image upload/cleanup and scheduled
  supplier syncing. Its `AI` binding is used only when an authenticated manager
  explicitly requests brand suggestions; it is not called on typing or public
  storefront traffic. Public image delivery goes directly through Supabase's CDN.
- Local URL is normally `http://127.0.0.1:3000`.
- Manager HTML routes redirect to `/signin` without a valid signed session.
  Every `/api/admin/*` route also verifies the session server-side. The password
  and signing secret are environment values, keeping authentication compatible
  with the free Cloudflare hosting plan. Unsafe admin and session writes require
  an exact same-origin browser request, and manager HTML/admin API responses add
  no-store, anti-framing, content-type, referrer, permissions and content-security
  headers.

### Supplier import — `modules/catalog-import/`

- Plain TypeScript with no dependency on the UI framework.
- Reads the supplier's public Shopify `new-arrival` collection JSON feed.
- Normalizes articles and variants, fingerprints changes, records import runs,
  and creates or updates private catalog drafts.
- `scripts/import-supplier-local.ts` provides the manual command-line import.

### Persistence — `db/` and `drizzle/`

- Cloudflare D1 / SQLite stores supplier data, public catalog settings, manual
  articles, orders, offer codes and shop settings.
- `db/schema.ts` is the typed schema reference.
- `drizzle/0000_haley_wali_catalog.sql` creates supplier-import tables.
- `drizzle/0001_store_lifecycle.sql` creates manual article and order tables.
- `drizzle/0002_production_lifecycles.sql` adds complete article details, Pret
  size stock, checkout idempotency and customer-care requests.
- `drizzle/0003_admin_signin_protection.sql` adds Store Manager sign-in
  throttling without a paid authentication service.
- `drizzle/0005_product_reviews.sql` adds moderated customer article reviews.
- `drizzle/0006_offers_and_delivery.sql` adds nationwide delivery settings,
  offer codes and order discount snapshots.
- `drizzle/0007_season_sale.sql` and `0008_sale_description.sql` add the
  editable automatic sale campaign.
- `drizzle/0009_approved_article_brands.sql` stores manager-selected canonical
  brand suggestions so later articles do not require another AI request.

## Hosting direction

- Public storefront: Astro on Cloudflare.
- API and store manager: Cloudflare Worker with D1 binding `DB`.
- New manually added article images are browser-optimized WebP files stored in
  a public Supabase Storage bucket and served directly through its CDN. D1
  stores only their URLs in article records. Supplier URLs remain external
  unless their media is later copied with permission.
- Domain: `haleywali.pk` is the canonical public storefront origin. A deployed
  Cloudflare Single Redirect permanently sends `www.haleywali.pk` to the apex
  while preserving the request path and query string.
- Store Manager domain: `manager.haleywali.pk` is the canonical production
  route and the storefront's production catalogue API base. The manager
  production `workers.dev` route and deployment preview URLs are disabled.
  Local development remains available at `http://127.0.0.1:3000`.

The root `wrangler.jsonc` owns the Store Manager/API Worker and its D1 binding.
`apps/storefront/wrangler.jsonc` owns the public Astro Worker. Both use
Cloudflare Workers and are intended to remain inside the free-tier limits at
the initial shop volume.

## Important boundaries

- The storefront never receives buying cost, supplier price or margin.
- Imported supplier drafts and manually added articles begin with separate
  write paths. Publishing owned supplier stock converts it to the normal
  article path and removes the duplicate supplier/catalog rows; the public
  catalogue combines normal articles with any remaining on-demand imports.
- The bag is device-local browser state. Orders become durable only after the
  checkout API accepts them.
- The order-success page uses a free `wa.me` link with a prefilled confirmation
  message. The customer must send it manually; no paid WhatsApp API is used.
- The wishlist is also device-local and stores only article IDs. The Wishlist
  page resolves those IDs against the live public catalog so unpublished or
  unavailable articles are not presented as purchasable.
- Article stock and customer-care requests are durable D1 data. Pret stock is
  normalized by size for safe checkout updates.
- Customer reviews are submitted without sign-in, saved as pending and shown
  publicly only after Store Manager approval.
- Uploaded files are limited to validated JPG, PNG and WebP images. Removing an
  uploaded image during an article edit, deleting an article, or abandoning a
  new upload triggers deletion when no manual article still references it.
- The Store Manager targets 600 KB WebP images and the Worker rejects uploads
  over 700 KB. Production uploads require `SUPABASE_URL`,
  `SUPABASE_SECRET_KEY` and `SUPABASE_STORAGE_BUCKET`; the secret key is
  never exposed to either browser application.
- Supplier identity is an internal operational detail.
