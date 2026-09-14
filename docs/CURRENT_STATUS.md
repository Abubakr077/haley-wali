# Current status and next work

Status reviewed from source and production configuration on **2026-09-14**.

## Implemented

- `star-bucks-design` branch retail system across the storefront using the
  established Haley Wali pink/blush/burgundy palette, rounded content cards,
  compact pill actions, soft elevation and a shared floating bag button. The
  homepage keeps its full-width campaign photograph as the hero exception.
- Haley Wali pink/burgundy storefront with the supplied monogram and tag assets.
- Compact shop and inner-page headers that keep article controls and page
  content visible without repeating homepage-scale empty space. Inner pages use
  a short title row; the homepage campaign photograph remains the only large
  editorial header.
- Desktop HW Exclusive and Branded navigation now opens full-width,
  keyboard-accessible mega menus with direct Pret/ready-to-wear and unstitched
  collection links. Branded additionally lists only brand names found in
  current published stock. Mobile presents the same hierarchy as expandable
  menu groups, and type links arrive with the catalogue filter already active.
- Public share metadata for WhatsApp, Facebook and similar apps: PNG favicon
  and apple-touch icon, a default `og-share` card, Open Graph/Twitter tags, and
  per-article titles, descriptions and photos on `/product?id=`. Bag, checkout
  and success pages are `noindex`. `robots.txt` and `/sitemap.xml` list public
  shop pages and published articles.
- Mobile storefront controls use 44px touch targets. The smallest phone layout
  shows one readable article per row, catalogue sorting no longer overlaps the
  collection introduction, and article measurement tables scroll sideways
  inside their card without widening or clipping the page. Home collection
  photography preserves a 311:373 portrait panel with `object-fit: cover`, so
  the Branded source image is not stretched on 360–430px phone screens.
- Checkout and bag use top-aligned two-column cards on desktop, while keeping
  the same cards in a natural single-column order on smaller screens.
- The mobile and desktop homepage use one combined photographic hero. Mobile
  copy and shopping actions overlay the campaign image with a stronger gradient
  instead of becoming a separate burgundy section.
- The homepage hero uses the supplied campaign still, an automatic sale slide
  while a store-wide sale is active, and one dynamic slide for every published
  HW Exclusive article. Publishing or unpublishing an HW Exclusive article
  automatically adds or removes its slide. It cross-fades slowly, includes
  accessible SVG-chevron arrows and dots, supports
  touch swipes, pauses during interaction and respects reduced-motion settings.
  When no published article is available it remains a fast single-image hero.
- The homepage hero is full viewport height. The homepage header overlays it
  transparently with white navigation at the top, then animates into the normal
  blush, burgundy and blurred header treatment after the visitor scrolls; other
  pages retain the existing sticky header.
- A 10% Season End Sale is enabled by default for every published article. The
  Store Manager Overview and dedicated `/settings` page control its name,
  percentage, slide description and active state. Public
  catalogue responses include original and reduced prices; product cards,
  article details, bag and checkout present the original price struck through,
  while the Worker recomputes and snapshots the reduced unit price when an
  order is placed. Offer codes are hidden and rejected while the automatic sale
  is active so discounts cannot stack; they return when the sale is switched off.
- Mehr uses a dedicated generated landscape image only in the Home slideshow;
  its saved article images and article details remain unchanged.
- The Season End Sale slide uses a separate generated Khaak campaign background
  with live HTML sale copy and links. It does not replace Khaak's article images.
- SEO includes canonical and Pakistan-English alternate links, large image
  previews, store/website structured data, Product and breadcrumb structured
  data, and product price/availability social metadata. Search, tracking,
  wishlist, bag, checkout and success are excluded from search indexing; the
  sitemap contains only public shopping, information and article URLs.
- Shared customer loading states across Home featured articles, Shop, Search,
  article details, Wishlist, Bag, Checkout, order confirmation, order tracking
  and reviews. Article lists use card skeletons; smaller requests use a clear
  spinner panel and submission controls stay disabled while sending.
- Home, Shop and Search render the published catalogue on the storefront server
  first, then refresh in the browser. This keeps published articles visible and
  indexable when a browser cannot complete the subsequent catalogue refresh.
- The Home-page HW Exclusive collection card composes its image panel from the
  first/main photos of the first four current published HW Exclusive articles,
  repeating the available images when fewer than four are published and
  retaining its supplied fallback only when no article images are available.
  The adjacent Branded card remains image-led rather than using third-party
  logo artwork.
- Store Manager reads the established public D1 catalogue immediately and runs
  schema preparation only when a new or older database actually needs it. It
  also caches that readiness work for each active Worker isolate. The storefront
  does not impose a client-side catalogue timeout: slow connections remain
  visibly loading, while genuine connection failures use a retry state rather
  than an incorrect empty catalogue.
- Astro customer website with React only for interactive shopping areas.
- The public catalogue API accepts the canonical `haleywali.pk` origin, its
  `www` redirect origin and the direct storefront Worker URL, so the same
  published stock loads on both public and operational storefront addresses.
- Home, shop, search, product details, bag, COD checkout, confirmation, tracking,
  contact, policies, about and 404 pages.
- There is no shared Size Guide page or Urdu measurement translation. Each Pret
  article shows only its own saved Article Measurements table.
- Pret product details include one Article Measurements table built from the
  article's saved shirt and trouser values, with size columns and selected-size
  highlighting. The image viewer uses layout-based zoom so its zoom level is
  visible and scrollable.
- Article galleries are image-first with a soft animated photo transition,
  overlay previous/next actions, progress indication and a full-screen
  `View all photos` viewer. There is no separate white thumbnail/navigation
  area below the product image.
- The full-screen image viewer uses a transparent burgundy-blurred, image-first
  canvas with minimal close/side navigation controls and a floating zoom
  control, rather than a large fixed toolbar.
- Article details include moderated customer ratings and reviews. Anyone can
  submit and may attach one optional photo. The browser compresses it to WebP
  before the Worker validates and uploads it to Supabase Storage. Store Manager
  can inspect the photo with the pending review; only approved reviews and
  photos appear publicly, and deleting the review cleans up its stored photo.
- Published articles remain visible across Home, Shop, Search, Wishlist and
  article details after stock reaches zero. Cards show an `Out of stock` badge,
  article details disable sold-out Pret sizes and Add to Bag, and checkout keeps
  its server-side stock validation.
- Approved rating averages and counts appear on article cards and beside the
  article name on details. Home shows up to six latest approved reviews in a
  responsive section after featured articles, including review photos and
  direct article links when available. Until the first approved review exists,
  Home shows one clearly marked sample-review preview so its final placement and
  styling can be reviewed without presenting it as real customer feedback.
- Article review details follow familiar ecommerce structure: a compact inline
  rating link below the article subtitle, average score, five-to-one-star
  distribution, most-recent heading, customer initials and optional review
  photography. No verified-purchase claim is shown because reviews are not yet
  linked to completed orders.
- Product details show exact remaining stock, a device-local wishlist action
  and live related articles; the header links to a dedicated Wishlist page.
- A free product-page WhatsApp help action is prefilled with the article name,
  code, current price, selected size and direct product link.
- Store Manager list/detail routes for articles, supplier import, orders,
  offer codes and customer-care requests.
- Password-protected Store Manager pages and admin APIs using a signed secure
  cookie. This needs no paid authentication provider.
- Store Manager sign-in uses constant-time credential verification and blocks an
  address for 15 minutes after five failed attempts.
- The live Store Manager and public API use `manager.haleywali.pk`. The manager
  production `workers.dev` route and preview URLs are disabled in Cloudflare and
  in `wrangler.jsonc`. Unsafe admin/session writes require the exact manager
  origin, sign-in accepts only small JSON bodies, and manager responses add
  no-store, CSP, anti-framing and related browser security headers. These
  controls do not affect localhost testing.
- The 2026-09-01 coordinated deployment moved the storefront catalogue API to
  `manager.haleywali.pk`; the owner verified a live `200 OK` article response.
  Deployment scripts now record and inject only the canonical customer and
  manager domains instead of discovering Worker subdomain URLs.
- Restricted public API CORS using the configured storefront origin.
- Manual article draft, edit, publish, unpublish and delete workflow.
- Imported Pret selected as owned Haley Wali stock now asks for quantity by
  size. Publishing converts it into the normal Articles workflow with the same
  public ID, opens the full image/detail/stock editor, and deletes the duplicate
  supplier and import-product rows. Future supplier syncs skip that ID while
  the normal article exists. These articles use the approved internal grouping
  `Other Brands`, while the public article label remains the generic `Branded`.
- `Other Brands` is also a built-in approved choice when manually creating a
  real Branded article whose original brand should not be named. It appears as
  one customer filter and mega-menu choice without exposing a supplier name.
- Shop and search collection headers place Filter and Sort together in a compact
  toolbar. The Filter control opens a desktop popover or mobile bottom sheet for
  brand, Pret/ready-to-wear or unstitched article type, size, suit pieces,
  fabric, colour and current PKR price range. Facet choices come only from
  published articles and the control reports the active-filter count. Branded
  brand choices use the real brand names on currently published articles.
  Store Manager canonicalizes its
  built-in names and known misspellings without AI. Optional AI matching for a
  brand outside that list is available only through an explicit
  `AI Suggestions` button after the manager finishes typing; changing the input
  never makes an AI request. The manager must select a suggestion before it is
  added to the persistent approved registry, and repeated queries are cached
  within the active Worker.
- Store Manager image upload for new and existing manual articles using
  browser-optimized WebP files in Supabase Storage, with main-image selection,
  gallery previews, drag-and-drop/multi-file selection for up to eight source
  images and validated JPG/PNG/WebP uploads. File signatures
  are used instead of extensions, so valid phone or supplier JPEGs that were
  named `.webp` do not fail upload. Images require at least 1200px on their
  shorter side and retain higher detail for the product zoom. This requires no
  R2 subscription.
- There is no D1 image-file fallback or image migration path. D1 stores only
  Supabase public URLs for new article uploads.
- Uploaded Haley Wali image files are removed when taken out during editing or
  when their article is deleted; abandoned new uploads are cleaned up on form
  exit when the browser can complete the request.
- Full article information: code, gallery, pieces, season, fabric, colour, care,
  garment details, included pieces, model details and Pret measurements.
- Pret stock per size and total stock for unstitched articles.
- Checkout idempotency, live price checks, conditional stock decrement and
  one-time stock restoration when an order is cancelled.
- Store Manager order details allow permanent deletion after an order is
  cancelled, preserving the required stock-restoration lifecycle and cleaning
  up related order articles and offer-redemption data.
- D1-backed COD orders, free customer WhatsApp-confirmation button and public
  order tracking. The button opens a prefilled `wa.me` message that the customer
  sends manually; the paid Meta notification hook has been removed.
- Store Manager nationwide delivery PKR (default 250), an editable automatic
  shop-wide sale (default 10% Season End Sale), plus offer codes for
  percent off, fixed PKR off and/or free delivery. Bag, checkout and the
  delivery page read the live charge. Checkout recomputes discount and delivery
  from D1 and never trusts browser-sent totals. This needs the next incremental
  deploy so pending D1 migrations through `0010_review_images` are applied.
- D1-backed exchange, return, complaint and question forms with manager handling
  stages and confirmed permanent deletion from the request detail page.
  Automatic owner email notification is deferred.
- Manual Shopify supplier import remains available for future Branded stock.
- Runtime demo seeding and public static demo catalog have been removed. A new
  production database starts empty and articles appear only after publication.
- ChatGPT Sites deployment files have been removed. Cloudflare Worker configs
  now own the Store Manager/API and Astro storefront deployments.
- The live Cloudflare environment has an established D1 database. Incremental
  releases are prepared to run from GitHub Actions after a push to `main`. The
  guarded workflow uses `npm run deploy:cloudflare:update`, which preserves
  articles, orders and Store Manager secrets and verifies record counts before
  and after. It remains disabled until the repository deployment secrets and
  `HALEY_WALI_DEPLOY_ENABLED=true` variable are configured.
- The 2026-08-27 incremental release deployed the mobile storefront and SEO
  refinements plus the combined mobile photographic hero. The post-deployment
  D1 check preserved 1 manual article, 0 imported articles and 1 order;
  `haleywali.pk`, the storefront Worker and Store Manager sign-in all returned
  HTTP 200 after deployment.
- The unused template Cloudflare Images binding and optimizer route were removed;
  the manager currently serves only its normal bundled assets.

## Must finish before public production launch

1. Keep strong `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` values and periodically
   test sign-in and sign-out on `manager.haleywali.pk`.
2. Live-test the configured public WhatsApp confirmation button on the deployed
   order-success page. Automatic owner email notification can be added later.
3. Add production abuse protection for checkout, tracking and customer-care
   forms. Store Manager sign-in protection is complete.
4. Add production logs, error monitoring and a basic D1 backup/export process.
5. The public domain `haleywali.pk` is connected to the storefront Worker.
   Cloudflare permanently redirects `www.haleywali.pk` to the apex while
   preserving paths and query strings. Verify upload/edit/delete on the live
   image lifecycle if that has not been checked since Supabase was configured.
6. When Branded supplier stock is enabled, confirm media permission, decide
   whether approved supplier images should remain external or be copied into
   Supabase Storage, and configure the supplier Cron Trigger if wanted.

## Known cleanup and review items

- The final Haley Wali Instagram URL is still needed; the old Noor Luxe link was
  removed rather than shown publicly.
- Existing local D1 data may still contain old demo records. New production D1
  databases remain empty because runtime seeding has been removed.
- Final responsive visual review is still required when production article
  photography and copy are complete.

## Verification note

The Store Manager/API and storefront production builds passed during the
2026-08-11 requested test run. Catalog/import tests passed. Two older rendered
lifecycle tests still need updates for protected Store Manager redirects,
authenticated admin API calls and the now-required article publication fields.
Verification should also include Pret size concurrency, duplicate checkout,
cancellation stock restoration, customer-care forms and desktop/mobile UI.
