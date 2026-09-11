# Rules for Cursor, Codex and other LLMs

## Start every task here

1. Read `docs/README.md` and the files related to the requested area.
2. Read `project-context/CURRENT_STATUS.md` for known unfinished work.
3. Inspect current source before proposing or editing code.
4. State any assumption that changes customer behaviour, pricing, stock,
   publication, security or deployment.

## Preserve these decisions

- Brand is Haley Wali; planned domain is `haleywali.pk`.
- Main collections are only `HW Exclusive` and `Branded`.
- Pret and Unstitched are types inside Branded.
- Supplier identity is private and must not appear on the customer website.
- Supplier imports create drafts and never publish or set owner prices.
- Public prices are PKR and checkout is Cash on Delivery. Nationwide delivery
  PKR is a Store Manager setting (default 250) and must be recomputed by the
  Worker. Do not hardcode delivery or trust a browser-sent discount.
- Storefront remains Astro with React islands. Do not convert it to a full React
  or Next SPA without explicit approval.
- Use the supplied monogram artwork, not typed `hw` and not a box/circle logo.
- Pink/blush/burgundy is the theme; do not restore the old blue scheme.
- Admin pages and APIs require the signed Store Manager session. Do not remove
  this protection; production credentials must remain environment secrets.
- Store Manager uses separate Overview, Articles, Supplier Import, Orders,
  Offers, Customer Requests and Product Reviews routes with shared sidebar
  navigation; do not merge them back into tabs.
- Article and supplier-import management must use list -> selected detail pages.
  Never render every article's full edit form on the list screen. Keep search,
  status filters and pagination when these lists grow.
- Keep the order queue as a list and show customer/address/article details only
  on the selected order's details page.

## Editing rules

- Work in source files, not generated `dist` output.
- Preserve unrelated owner changes.
- Use a migration for D1 schema changes and update `db/schema.ts`.
- Do not expose buying cost, supplier price, margin, credentials or customer data
  through public endpoints or logs.
- Never put secrets or real customer information in Markdown context files.
- Do not remove publication checks to make a draft appear in the shop.
- Keep forms readable and touch-friendly and remove accidental blank space.
- Prefer clothing-market wording understood in Pakistan.
- Do not run automated tests unless the project owner explicitly asks for them.

## Completion standard

A change is not complete only because it builds. Check its complete life cycle:

- article: create/import -> price -> publish -> browse -> add to bag;
- order: checkout -> save -> notify -> manage -> track;
- UI: desktop -> mobile -> empty/error/loading states;
- data: validation -> persistence -> public privacy -> failure recovery.

When the owner asks for verification, run focused tests plus the relevant full
build. For UI changes, review the affected pages rather than only the home page.
Record meaningful new decisions, known gaps and verification results in this
folder.
