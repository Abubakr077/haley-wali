# Design system and UI rules

## Direction

The `star-bucks-design` branch applies a rounded retail layout across the
storefront. It keeps the established Haley Wali pink, blush and burgundy
palette while using rounded cards, compact pill buttons, soft elevation, warm
surfaces and a floating bag action. The visual system covers home, shop,
search, product details, bag, checkout, tracking, customer-care and information
pages without changing their business behaviour.

The desktop homepage hero uses the campaign photograph full width so its brown
wall becomes the natural text background and the model remains in one continuous
scene. Do not split this photograph into a solid-colour text panel and image.

The active layout reference is `docs/star_bucks_design.md`: friendly sans-serif
type, compact full-pill buttons, 12px cards, restrained elevation, warm surface
blocks and a circular floating bag action. Translate those rules into the Haley
Wali palette and clothing language; do not copy Starbucks branding. The only
deliberate layout exception is the full-width photographic homepage hero.

Haley Wali should feel polished but remain easy for Pakistan clothing customers.
Avoid layouts that are clever but difficult to shop.

## Current palette

The storefront variables in `apps/storefront/src/styles/global.css` are the
source of truth:

| Token | Value | Use |
| --- | --- | --- |
| `--ink` | `#5c3130` | Main burgundy text and icons |
| `--muted` | `#766165` | Secondary text |
| `--paper` | `#fffafb` | Main warm-white background |
| `--chrome` | `#f5e8eb` | Header and light pink areas |
| `--blush-wash` | `#f3c6cd` | Strong pink brand section |
| `--accent` | `#7b3f42` | Buttons and emphasis |
| `--line` | `#dfc8cd` | Borders and dividers |
| `--danger` | `#8a2d3f` | Destructive/error state |

Blue is not the Haley Wali theme. Use pink, blush and burgundy from the physical
tag design. Maintain readable contrast; pale pink is a background, not body-text
colour.

Homepage-only campaign styling is scoped under the `home-starbucks` body class.
The shared card, form, button, navigation and footer system applies throughout
the storefront and reuses the same pink, blush and burgundy colour roles.

## Brand assets

Production-ready website assets are in `apps/storefront/public/brand/`:

- `haley-wali-monogram.svg`: actual `hw` artwork from the logo; use without a
  box or circle in the header/footer.
- `haley-wali-logo.svg`: full logo when a complete wordmark is appropriate.
- `haley-wali-round-sticker.svg`: packaging/sticker presentation.
- `haley-wali-hangtag-front.svg` and `haley-wali-hangtag-back.svg`: physical tag
  presentation.
- `favicon-32.png` and `apple-touch-icon.png`: raster icons for browser tabs,
  home-screen shortcuts and chat apps that ignore SVG.
- `og-share.png`: default 1200×630 share card (monogram, Haley Wali, Clothing
  for Pakistan). Article pages use the published article photo when it is a
  public raster URL.

`apps/storefront/public/site.webmanifest` names the PNG icons and the blush
theme colour. Shared Open Graph, Twitter and canonical tags live in
`apps/storefront/src/layouts/BaseLayout.astro` and always use
`https://haleywali.pk`.

Original source files supplied by the owner are outside the repository in the
Downloads folder. Do not require those external files at runtime.

## Layout rules

- Header logo must be vertically centred and visually fill the top-bar height
  without adding a visible container shape.
- Keep the desktop top bar compact at about 60px. The monogram should fit within
  roughly 42px by 36px so it does not force the navigation taller than the
  Starbucks reference proportions.
- On desktop, use the Starbucks-style three-part navigation: compact Haley Wali
  brand block on the left, strong text links centred, and Search plus one filled
  Bag pill on the right. Keep the navigation on the Haley Wali light-pink
  surface. On mobile, use a simple menu.
- HW Exclusive and Branded use full-width desktop mega menus rather than narrow
  cascading flyouts. Keep the editorial introduction, article types and
  discovery/available-brand links in three readable columns. Open on hover and
  keyboard focus without preventing the main category link from working.
  Branded brand links must come from current published stock. On mobile, present
  the same hierarchy as tap-to-expand groups inside the main menu.
- Main categories are `HW Exclusive` and `Branded`; Pret and Unstitched are
  filters/types under Branded.
- Collection headers keep Filter and Sort as compact, side-by-side controls.
  Do not permanently fill the header with brand pills. Filter opens a desktop
  popover and a phone bottom sheet containing only values present in published
  articles: brand, article type, size, suit pieces, fabric, colour and current
  PKR price range. Show the active-filter count on the Filter control.
- Keep shop and information-page headers compact. Inner pages use a short title
  row (about 24–28px) and optional one-line note so filters, articles or forms
  start near the top. Homepage-scale titles and large editorial spacing belong
  on campaign sections, not repeated utility pages. Do not wrap inner page
  titles in tall empty cards.
- On mobile and desktop, homepage hero copy and shopping actions sit over the
  campaign photograph. Use a stronger mobile gradient for readability; never
  turn the hero copy into a separate full-screen burgundy panel.
- The Home hero uses a restrained, Sapphire-inspired presentation: the
  established campaign photograph first, an automatic season-sale slide when
  that setting is active, then every published HW Exclusive article in catalogue
  order. Slides cross-fade every six seconds, pause during interaction,
  support compact SVG-chevron arrows, scrollable dots and touch-swipe navigation,
  and stop automatic movement
  when the customer prefers reduced motion. Keep the first still image as the
  eagerly loaded performance fallback; do not make video a required first-load
  dependency.
- The season-sale slide uses a full-bleed HW Exclusive campaign photograph with
  direct live HTML sale typography and actions, following the clear editorial
  pattern used by established Pakistani clothing stores. Its percentage stays
  synchronized with Store Manager. A slideshow-only landscape Mehr campaign
  image may replace Mehr's portrait catalogue image in the hero; neither hero
  asset may alter an article gallery or saved article details.
- The Home hero fills the browser viewport on desktop and mobile. Its navigation
  overlays the photograph with a transparent, white-control treatment at the
  top of the page, then eases into the established blush background, burgundy
  controls, soft shadow and blur after scrolling. Inner-page headers keep their
  normal sticky blush treatment.
- Product image gets priority. Product information and View action must fit in a
  compact card without a large empty lower area.
- During an automatic sale, catalogue cards, article details, bag and checkout
  show the original PKR price struck through beside the reduced price. The
  reduced price is the primary, higher-contrast value.
- The HW Exclusive collection card on Home uses the first/main photograph of
  the first four current published HW Exclusive articles as a small responsive
  collage. When fewer than four articles are published, it repeats the
  available first images to retain the same four-tile layout. It may fall back
  to the supplied collection image only when no published article photo exists.
  On desktop, it preserves the established 311:373 portrait visual ratio. The
  adjacent Branded card remains image-led rather than displaying third-party
  logo artwork. Collection photographs must use `object-fit: cover`; at phone
  widths the image panel keeps the established 311:373 portrait ratio so source
  photography is cropped rather than stretched.
- Any customer-facing asynchronous state must have a visible loading treatment;
  never leave a blank section while articles, an order, a wishlist or reviews
  are being loaded. Article lists use four-card shimmer placeholders, while
  forms and detail areas use the compact Haley Wali spinner panel.
- Product detail galleries use an image-first, Zara-inspired treatment adapted
  for Haley Wali: a large photograph, subtle hover/focus arrows, a translucent
  photo-count/progress overlay and a `View all photos` action that opens the
  full-screen viewer. Changing pictures uses a short fade/scale transition.
  The controls remain visible on touch layouts. Do not copy another retailer's
  branding, assets, text or source code. Shared main-image sizing must never
  stretch gallery controls or create a white navigation band below the photo.
- On desktop, the product gallery is a natural-height sticky card. It stays
  visible while the longer article information column scrolls and must never
  stretch down to match the specifications column.
- The main product image opens an accessible full-screen viewer with zoom,
  reset, previous/next and close controls. Keep the viewer image-first: use a
  transparent burgundy-blurred canvas, minimal close and side navigation controls, and a
  compact floating zoom control rather than a large toolbar.
- Homepage, product-gallery and full-screen-viewer side navigation uses the
  same compact frosted circle and thin SVG chevron. Do not use text arrow glyphs;
  their weight and alignment vary between browsers and fonts.
- Product details use a compact rounded review card with rating summary and a
  pill-shaped `Write a review` disclosure that fills leftover heading space.
  Keep the form collapsed until the customer asks for it; do not give reviews
  landing-page scale.
- Keep the article-title rating as a slim star, average and count link directly
  below the subtitle. The detailed review section may use a larger average,
  five-to-one-star distribution and recent-review list, but must not claim a
  verified purchase until review records are securely linked to completed orders.
- Article cards show a compact approved rating average and count below the
  article name. Product details repeat that summary beside the name and link it
  to the full review section. When stock is zero, retain the article photography
  and replace the image badge with a high-contrast `Out of stock` status.
- Home places up to six latest approved reviews in a responsive card grid after
  featured articles. Review photos may lead their card; text-only reviews use
  the same card treatment. Keep this content in the page flow so it never covers
  navigation or the floating bag control. If there are no approved reviews, one
  visibly labelled sample card previews this area and disappears automatically
  after the first real approved review.
- Pret product details show one Article Measurements table using that article's
  saved values. Sizes are columns, measurements are rows, and the selected size
  is highlighted. The heading stays stacked above the table so size columns can
  use the full card width. There is no shared size-guide page: every article may
  have different measurements. The table must fit its desktop card without
  clipping and may scroll horizontally only on narrow screens. Do not repeat the
  same data in a separate quick chart.
- Article cards use a small top-right heart action. Product details pair the
  main bag action with a secondary wishlist pill, and show exact remaining
  stock close to the size and purchase controls. Size chips and the bag/wishlist
  row fill the product-copy width; the two purchase pills share one row and the
  same height. A compact WhatsApp help block directly below them supports size,
  fabric and article-detail questions without competing with Add to Bag.
  Fabric/colour and similar facts sit in a two-column spec grid.
  Included pieces use filling pills, and shirt/trouser/dupatta share one row.
  For Pret, Add to Bag remains disabled until a size is selected and explains
  that requirement on hover or keyboard focus. Packing/tag storytelling belongs
  on the homepage, not in each article detail page.
- Related articles appear after reviews in the same four-card retail grid used
  by the shop, preferring articles from the same collection.
- Do not add fixed minimum heights merely to make columns equal if they create
  obvious blank space.
- In desktop two-column shopping flows, sibling cards must begin on the same
  horizontal line. A general form margin must not push the checkout delivery
  card below its order summary; mobile may stack those cards naturally.
- Remove accidental gaps between sections and before the footer. Spacing must
  come from the section that owns it, not stacked margins from both sections.
- Use 12px rounded cards with the restrained two-layer retail shadow. Cards may
  gain a slightly stronger shadow on hover but should not jump upward.
- Customer actions use full pill buttons with a 50px radius, `7px 16px`
  padding, 14–16px labels and `scale(.95)` press feedback. Do not mix plain
  underlined action links with pill buttons inside cards.
- The floating bag is a 56px burgundy circle on customer pages. It is omitted
  on bag, checkout and order-success pages where it would duplicate the active
  flow.
- Keep form labels and entered text at normal readable sizes. Inputs must be at
  least about 44px tall for touch use.
- Search should follow the reference pattern: clear top label and Close action,
  wide underlined field, then useful categories and products.
- Footer uses the monogram only, then compact Shop, Help and About columns and a
  bottom copyright row. Do not repeat large `HALEY WALI` text beside the footer
  monogram.

## Copy and accessibility

- Keep type readable and avoid tiny grey form text.
- All icon-only controls need accessible labels.
- Preserve keyboard focus, skip link and touch targets.
- Use `article`, not `item` or abstract commerce jargon, in customer copy where
  it sounds natural.
- Do not publicly mention the upstream Pret supplier.

## Visual review checklist

Check home, shop, search, product, bag, checkout, tracking, information pages,
manager and mobile widths. Look specifically for horizontal overflow, clipped
headings, oversized empty sections, misaligned logo/icons, unreadable inputs,
cards with unused space, and footer gaps.
