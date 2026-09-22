# Data, API, import and pricing

## D1 tables

### Supplier import

- `suppliers`: supplier connection and last sync time.
- `supplier_products`: source title, URL, images, variants, source price,
  availability, timestamps and content fingerprint.
- `catalog_products`: Haley Wali title, buying cost, selling price, pricing
  settings, publish state, supply mode and owned stock for an imported article.
- `import_runs`: audit of successful and failed import runs.

### Store catalog and orders

- `manual_products`: HW Exclusive and manually added Branded articles.
- `manual_variant_stock`: stock quantity for each Pret article size.
- `orders`: customer delivery details, article subtotal, applied offer code,
  discount, live delivery amount, total, status and optional PostEx tracking
  number. Its legacy
  `whatsapp_status` column remains unused to avoid a destructive migration.
- `order_items`: article title, selected size, quantity and price snapshot.
- `store_settings`: singleton nationwide delivery PKR plus automatic sale name,
  editable sale-slide description,
  percentage and active state. Defaults are PKR 250 and an active 10% Season
  End Sale until the owner changes them.
- `offer_codes`: one reusable code, discount type, optional free delivery,
  collection scope, optional dates, minimum subtotal, max uses and per-phone
  limit.
- `offer_redemptions`: one row per used offer on an order, used for max-use and
  per-phone checks in the same checkout batch.
- `customer_requests`: exchange, return, complaint and question records.
- `admin_login_attempts`: hashed network-address counters used only to throttle
  failed Store Manager sign-in attempts.
- `product_reviews`: article rating, customer display name, comment, optional
  Supabase photo URL, moderation status and a one-way submitter hash used for
  basic submission throttling.

JSON text columns hold galleries, variants and included pieces. Treat changes to
these shapes as API changes and add migrations when the database shape changes.

## Public API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/catalog/articles` | Published and priced articles from both catalog sources, including sold-out articles and approved rating summaries. |
| GET | `/api/catalog/pret` | Legacy Pret-only compatibility endpoint. |
| GET | `/api/shop/settings` | Public nationwide delivery and automatic sale settings. |
| POST | `/api/offers/preview` | Recalculate bag subtotal, optional code, delivery and total from D1. |
| POST | `/api/orders` | Validate live catalog data and create a COD order. Optional `offerCode`. |
| GET | `/api/orders/track?number=...&phone=...` | Customer order tracking; returns a PostEx number only for dispatched or delivered orders. |
| POST | `/api/support/requests` | Save an exchange, return, complaint or question. |
| GET/POST | `/api/reviews` | Read approved article reviews or submit a new pending review. GET with `?latest=1&limit=6` returns recent approved reviews for published articles. |

Public article responses may contain public title, selling price, original
pre-sale price, automatic sale name/percentage, brand,
collection, garment type, images, pieces, details and available variants. They
also contain approved review count and average. A published article remains in
the public response when its stock reaches zero so the storefront can label it
out of stock; checkout still rejects quantities that are not available. They
must not expose supplier identity, supplier price, buying cost or margin.

## Admin API

| Method | Route | Purpose |
| --- | --- | --- |
| GET/POST/PATCH/DELETE | `/api/admin/articles` | Manage manually added articles. Delete uses `?id=`. |
| GET | `/api/admin/brands` | Return the code-backed approved Branded names and recognized aliases. |
| POST | `/api/admin/brands/suggest` | On an explicit manager button click, use Workers AI to propose at most three canonical real fashion-brand names. |
| POST | `/api/admin/brands/approve` | Persist the manager-selected AI suggestion so it can be reused without another AI request. |
| POST/DELETE | `/api/admin/article-images` | Upload authenticated optimized article images to Supabase Storage or remove an unreferenced upload. |
| GET/PATCH/DELETE | `/api/admin/catalog/imported` | Price, publish or archive imported drafts. Delete uses `?id=`. |
| POST | `/api/admin/import/supplier` | Run supplier sync immediately. |
| GET/PATCH | `/api/admin/settings` | Read or update nationwide delivery PKR. Whole rupees only, including 0. |
| GET/POST/PATCH | `/api/admin/offers` | List, create or update offer codes. GET with `?id=` returns one offer. |
| GET/PATCH/DELETE | `/api/admin/orders` | List orders, update an order stage or its PostEx tracking number after dispatch, or permanently delete a cancelled order. GET with `?id=` returns one order with its articles; DELETE also uses `?id=`. |
| GET/PATCH/DELETE | `/api/admin/requests` | List/detail customer-care requests, update their status or permanently delete one. DELETE uses `?id=`. |
| GET/PATCH/DELETE | `/api/admin/reviews` | Moderate or delete submitted article reviews. |

Public review submission does not require customer sign-in. New reviews and
their optional photos remain pending until approved. The browser converts one
optional JPG, PNG or WebP source photo of up to 8 MB into WebP, keeps it within
1600px on its longer side and targets 400 KB before submission. The Worker
checks the file signature and rejects optimized review photos over 600 KB before
uploading them under the `reviews/` prefix in Supabase Storage. A hidden spam
field, length limits and a maximum of five submissions per network address per
hour protect the free D1 plan from basic abuse without storing a raw IP address.
Deleting a review also removes its Haley Wali-hosted photo.
The article-specific GET response includes the full approved count, average and
five-to-one-star distribution; the displayed list remains capped at the latest
50 reviews.

Legacy `/api/admin/catalog/pret` GET/PATCH routes remain for compatibility.

All admin routes require the signed Store Manager session. The password and
session secret must be configured in the production environment. Public API
CORS allows only the comma-separated origins in `PUBLIC_STOREFRONT_ORIGIN`
plus local development origins. Production includes only the canonical apex
domain and its `www` redirect origin.
Five failed sign-in attempts from one network address cause a 15-minute block;
raw IP addresses are not stored. Unsafe session and admin writes require an
exact same-origin browser request. Sign-in accepts only a small JSON body, and
manager HTML/admin API responses are non-cacheable and receive CSP, anti-frame,
content-type, referrer and permissions hardening headers. The Worker accepts its
custom manager hostname only; localhost and `127.0.0.1` remain available for
development.

Branded manual articles are saved only with a built-in canonical name, an
existing Branded article name or a name in `approved_article_brands`. Known
aliases are normalized without an AI request. The suggestion endpoint is never
called by typing or public catalogue filtering; Store Manager calls it only
after the user selects `AI Suggestions`. An AI result is not accepted merely
because it was returned: the manager must select it, which persists that name
in `approved_article_brands` before it can be saved on an article.
`Other Brands` is a built-in approved grouping for manually sourced or imported
stock that must not expose an original supplier/brand. The public product label
remains `Branded`; catalogue filters and the Branded mega menu present one
`Other Brands` choice.

## Article image storage

- The Store Manager accepts up to eight JPG, PNG or WebP source files per upload
  with an 8 MB source-file limit. To keep the product zoom clear, the source
  must be at least 1200px on its shorter side. The browser retains up to 2560px
  on the longer side, targets 1 MB, and the Worker rejects an optimized upload
  over 1.2 MB.
- The Store Manager and Worker determine an image type from its file signature,
  not its filename. A valid JPEG incorrectly named `.webp` is normalized and
  uploaded safely; SVG and executable formats are not accepted.
- New production files use unique date-partitioned keys in the public Supabase
  bucket and immutable public caching. The Supabase secret key exists only
  as a Cloudflare Worker secret.
- Existing Supabase bucket names containing spaces are supported and safely URL
  encoded; new installations should still prefer `haley-wali-articles`.
- Local development and production both require Supabase configuration for
  image uploads and reject uploads when it is missing.
- Article updates delete uploaded images that are no longer referenced. Article
  deletion removes all of that article's unreferenced Supabase images through
  the Storage API. Newly uploaded files abandoned before saving are deleted on
  form exit when possible.
- External image URLs and supplier-hosted images are never deleted by Haley
  Wali cleanup logic.

## Stock and duplicate-order rules

- Pret quantity is reserved from `manual_variant_stock` for the selected size.
- Unstitched quantity is reserved from `manual_products.stock_qty`.
- Owned supplier stock is assigned by size when published, converted to a
  normal article, and then reserved from `manual_variant_stock`.
- Checkout uses a unique browser-generated token. Repeating the same request
  returns the existing order instead of creating a second order.
- Cancelling an order restores reserved stock once.
- Only cancelled orders may be permanently deleted. Deletion removes related
  order articles and offer-redemption data after stock restoration.

## Publication rules

An article is public only when all relevant rules pass:

- publication status is `published`;
- selling price exists and is greater than zero.

Publishing still requires real stock to be entered. Once published, reaching
zero stock does not automatically hide or unpublish the article; it stays
public with an out-of-stock status until the manager restocks or unpublishes it.

Imports create drafts. Imports do not publish, unpublish because of price edits,
or overwrite owner pricing.

`on_demand` remains a private planning state in Store Manager. An imported
article must be changed to owned stock and assigned quantity by size before it
can be published and converted into Articles.

Publishing an imported owned-stock Pret article converts it to
`manual_products` using the same public ID and writes its size quantities to
`manual_variant_stock`. The duplicate `catalog_products` and
`supplier_products` rows are deleted in the same D1 batch. Supplier sync checks
for that normal article ID before inserting, so the removed source copy is not
recreated while the article exists.

## Pricing formula

Prototype defaults:

- handling/packing allowance: PKR 250;
- target gross margin: 25%;
- round up to the next PKR 50.

```text
total cost = actual buying cost + handling/packing allowance
suggested price = total cost / (1 - target margin)
```

The owner may override the suggestion. Customer delivery is a separate Store
Manager setting (default PKR 250) and is not part of the article price. An offer
code may discount the article subtotal and/or set delivery to PKR 0 for that
order. Checkout never trusts a browser-sent delivery or discount amount.

## Offer codes

- One code per order. Codes are not stacked.
- A code may take a percent off the eligible article subtotal, a fixed PKR
  amount off that subtotal, free delivery, or a mix of those.
- Scope is all articles, HW Exclusive only, or Branded only.
- Optional start/end dates, minimum subtotal, maximum uses and one use per
  mobile number.
- Customer copy uses **code**, not “coupon”. Store Manager uses **offer**.
- `orders.subtotal_pkr` stays the full article total before discount.
  `total_pkr` is subtotal minus discount plus delivery.

## Supplier import details

- Source is internally called `Supplier A`.
- Current implementation reads:
  `https://chaudharyarts.com/collections/new-arrival/products.json?limit=250`.
- The supplier name must not appear in customer-facing UI or public API data.
- A Worker scheduled handler exists, but the production Cron Trigger still
  needs to be configured and verified.
- Recommended production interval is every six hours after permission and
  operational testing.
- Use public data only. Do not bypass access controls or hit the supplier at a
  high frequency.
