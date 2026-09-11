# Haley Wali — low-cost production architecture

## Stack decision

The public shop stays on the agreed stack:

- **Astro** for fast category, article and policy pages. Pret measurements are
  stored and displayed per article rather than on a shared size-guide page.
- **React islands** only where interaction is needed: search, filters, size selection,
  cart, checkout and account-free order tracking.
- **Cloudflare Pages/Workers** for hosting and server endpoints.
- **Cloudflare D1** for articles, prices, stock, orders and reviews.
- **Supabase Storage** for browser-optimized HW article images. This keeps
  launch free without requiring R2 billing activation.
- **Cash on delivery** remains the first payment method.

The catalog-import code is plain TypeScript and does not depend on the dashboard
framework. It can be called by the Astro app, a Worker schedule or a local script.
The React dashboard in `app/` is the internal operations screen. The customer
storefront is implemented separately in `apps/storefront/`.

## Store collections

The customer shop has two main collections:

- **HW Exclusive:** customised articles created by Haley Wali, not resale stock.
- **Branded:** changing branded stock. This collection contains both Pret and
  unstitched article types, including imported supplier Pret.

## Module 01: Branded Pret supplier import

The supplier site is Shopify-based, so the importer uses its public collection
JSON feed instead of repeatedly downloading and parsing full HTML pages. It
requests at most 250 products from the `new-arrival` collection in one low-frequency
request and normalizes:

- article ID, handle and title;
- description;
- gallery images;
- variants, sizes, SKU and availability;
- supplier display price and compare-at price;
- source update time.

Every run is recorded. New articles are inserted once, changed supplier fields are
refreshed, unchanged articles are left alone, and articles missing from the latest
run are marked unavailable.

The recommended production schedule is **every six hours**. This is frequent enough
for a clothing catalog without placing unnecessary load on the supplier. The Worker
already exposes a scheduled handler; the six-hour Cron Trigger is enabled when the
production Cloudflare project is connected.

## Safe publication lifecycle

```text
Supplier new arrival
        ↓
Imported Branded Pret draft
        ↓
Enter Haley Wali buying cost
        ↓
Review suggested selling price
        ↓
Choose on-demand or owned-stock
        ↓
Approve title, price and availability
        ↓
Public article API → Astro Branded collection
```

An import never publishes a product automatically. More importantly, later supplier
updates never overwrite Haley Wali's buying cost or selling price.

### Supply modes

- **On demand:** the article can be shown only while the supplier reports at least
  one available variant.
- **Owned stock:** supplier availability is ignored after purchase; the article is
  shown while Haley Wali stock is greater than zero.

## Pricing process

The supplier's website price is reference information only. The person buying the
article enters the **actual buying cost** from the invoice or agreed wholesale rate.

Default prototype settings:

- handling/packing allowance: **PKR 250** per suit;
- target gross margin: **25%**;
- suggested selling price rounded upward to the next **PKR 50**;
- delivery charge kept separate at checkout.

Formula:

```text
total cost = actual buying cost + handling/packing allowance
suggested price = total cost ÷ (1 - target margin)
```

Example: buying cost PKR 4,000 + PKR 250 allowance produces a suggested price of
PKR 5,700 after rounding. Estimated gross profit is PKR 1,450 and actual gross
margin is 25.44%.

The owner can override the suggestion before approval. If Haley Wali later offers
free delivery, the average delivery expense should be added to the allowance.

## Public data contract

`GET /api/catalog/articles` returns approved, priced and available HW Exclusive
and Branded articles. The older Pret-only endpoint remains available for
compatibility.
It exposes Haley Wali title, selling price, images, variants and stock mode. It does
not expose supplier identity, supplier price, buying cost or margin.

## Operating and legal guardrails

- Use public pages/feed only; never bypass login, bot protection or access controls.
- Keep the sync slow and cache-friendly; retry later instead of hammering a failed
  supplier request.
- Obtain the supplier's permission to reuse article photography and descriptions
  commercially. When production permission is confirmed, either keep approved
  source URLs or copy optimized media into Haley Wali's Supabase bucket.
- Keep supplier identity internal as `Supplier A`; it is not returned to the public
  storefront.

## Current implementation

- Store manager for adding, editing, publishing, unpublishing and deleting HW
  Exclusive and manually added branded articles.
- Owner pricing and publishing screen for imported Pret drafts.
- Manual **Run import now** action plus the local import command.
- D1-backed Cash on Delivery orders, customer tracking and admin order stages.
- Free customer order confirmation through a prefilled `wa.me` message; the
  customer sends it manually from the order-success page.
- Astro home, collection, search, article, bag, COD checkout, confirmation,
  delivery, exchange, sizing, contact and tracking pages.
- React islands for catalog filters, live Pret articles, size selection, bag,
  checkout and customer forms.
- Live public Pret API connected to the Astro category and article pages.
- Planned public domain: `haleywali.pk`.

## Remaining production modules

1. Live-test the configured public WhatsApp confirmation number.
2. Courier integration after an order is dispatched.
3. Supplier image copying after image-use permission is confirmed.
4. Owner authentication when the operations screen is no longer local-only.
