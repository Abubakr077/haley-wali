# Haley Wali

Cloudflare-ready clothing store with an Astro customer storefront, React
interaction islands, a React store manager, supplier importing, persistent
orders and a public article API.

Before development, read [docs/README.md](docs/README.md).
It is the shared product, architecture, design, lifecycle and handoff context for
developers, Cursor, Codex and other coding assistants.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
```

Open the local store manager at `http://127.0.0.1:3000`.

In a second terminal, start the Astro storefront:

```bash
npm run dev:storefront
```

Open the customer shop at `http://127.0.0.1:4321`.

## Add and publish an article

1. Open the local store manager and choose **Articles**.
2. Choose **HW Exclusive** for Haley Wali's own customised articles, or
   **Branded** for other Pret and unstitched stock.
3. Upload the main and gallery pictures, then enter the article name, buying
   cost, selling price and stock. An existing hosted image URL can still be
   pasted when needed.
4. Select **Add & publish article**.
5. Use **Save changes**, **Remove from shop**, **Publish**, or **Delete article**
   on its details page. Editing or deleting an article also removes its
   unreferenced Haley Wali image files from Supabase Storage.

Pricing and publication state is kept in the local D1 database while developing.
Nothing is deployed by these commands.

## Run the supplier import manually

There are two local ways to run the Chaudhary Arts new-arrival import:

1. In the store manager, choose **Supplier Import** and select
   **Run import now**. New articles appear as private drafts for pricing.
2. From the project folder, run:

```bash
npm run import:supplier
```

The command reads the supplier's public Shopify new-arrival feed, updates the
local database and refreshes
`modules/catalog-import/imported-products.json`. Importing never publishes an
article or overwrites Haley Wali's buying or selling price.

## Orders and free WhatsApp confirmation

Cash on Delivery checkout saves the order in D1. The store manager's **Orders**
section can move it through Received, Confirmed, Packed, Dispatched, Delivered
or Cancelled. Customers can track an order using its order number and mobile
number.

The order-success page opens a prefilled `wa.me` message to the store number.
The customer taps **Confirm order on WhatsApp** and sends that message manually.
This does not use the paid WhatsApp Business Platform or require an API token.

```text
PUBLIC_WHATSAPP_NUMBER=923001234567
```

Keep the public number in the repository-root `.env` without `+`, spaces or
dashes. The storefront loads that public value in local and production builds.
Automatic owner notifications are intentionally deferred; email can be added
later without changing the free customer confirmation flow.

## Included shape

- `apps/storefront/` is the public Astro + React customer shop.
- `modules/catalog-import/` contains the framework-independent Shopify importer
  and pricing engine.
- `db/schema.ts` and `drizzle/` define the Cloudflare D1 catalog schema.
- `worker/index.ts` runs imports and serves articles, orders and tracking APIs.
- `app/` is the internal React article, import and order manager.
- `docs/haley-wali-architecture.md` records the agreed Astro + React storefront
  architecture and publication rules.

## Useful Commands

- `npm run dev`: start the store manager
- `npm run dev:storefront`: start the Astro customer shop
- `npm run import:supplier`: recheck and import live supplier articles
- `npm run build:all`: build the dashboard and storefront
- `npm test`: run importing, pricing, dashboard and storefront checks
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Git and production releases

The canonical source repository is
[`Abubakr077/haley-wali`](https://github.com/Abubakr077/haley-wali) on the
`main` branch. Start future work by pulling the latest commit:

```bash
git pull --ff-only origin main
```

After making and testing a change, commit it and push `main`. The guarded
GitHub Actions workflow in `.github/workflows/deploy.yml` runs the full test
suite, applies forward-only D1 migrations, deploys the manager/API and
storefront in order, and confirms that production record counts are preserved.
It remains disabled until the repository variable
`HALEY_WALI_DEPLOY_ENABLED` is set to `true`, so the initial repository push
does not deploy the current changes.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Astro Documentation](https://docs.astro.build)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
