# User and store-manager flows

## Customer shopping flow

The Home hero automatically includes every published HW Exclusive article as
an individual slide, in catalogue order, alongside the campaign and any active
automatic-sale slide.

1. Customer opens Home, New In, HW Exclusive or Branded.
   On desktop, HW Exclusive and Branded open full-width mega menus on hover or
   keyboard focus. Both provide Pret/ready-to-wear and unstitched links;
   Branded also lists brand names from current published stock. On mobile, the
   same choices are tap-to-expand sections in the main menu. Type links open the
   collection with that filter already applied.
2. Customer uses the compact Filter and Sort controls together. Filter opens a
   focused panel for brand, Pret/ready-to-wear or unstitched article type, size,
   suit pieces, fabric, colour and current PKR price range. Available choices are
   generated from current published articles, so unavailable values do not leave
   empty permanent filters. Branded brand choices use the saved brand names.
3. Customer opens an article, checks pictures, pieces, fabric, size and price.
   If unsure, the customer can open a prefilled WhatsApp enquiry containing the
   article name, code, current price, selected size and direct product link.
   During an automatic sale, the original price is crossed out beside the
   reduced price; no sale code is required.
4. Customer chooses a size when required and adds the article to the bag.
5. Bag shows quantities, live nationwide delivery and an optional code field.
   An accepted code is kept in session storage through checkout.
6. Checkout collects name, Pakistani mobile number, address, city, optional
   postal code and note, then sends any accepted code with the order.
7. The API re-reads public prices and the Store Manager delivery amount,
   validates the selected size and any offer code, conditionally
   reserves/decreases stock, saves the order once using a checkout token and
   returns an `HW-...` order number. Invalid codes are rejected until the
   customer removes or changes the code.
8. Customer sees confirmation, opens a prefilled free WhatsApp message and taps
   send to confirm the COD order with Haley Wali. This manual message does not
   use the paid WhatsApp Business Platform. The customer can then track using
   order number plus mobile.
9. Any visitor can rate and review an available article without signing in.
   The review remains private until the Store Manager approves it.
10. Customers can save articles to a device-local wishlist, open them again
    from the Wishlist page and remove them using the same heart control.

Do not trust product prices, delivery amounts or discounts sent by the browser.
The current API looks up live catalog prices and Store Manager settings again,
applies either the active automatic sale or an optional offer code, and then
creates the order. The two promotion types never stack.

## Manual article flow

Use this for new HW Exclusive articles and manually sourced Branded stock.

1. Open Store Manager -> Articles to see the stock list.
2. Select an existing row to open only that article's details, or select Add New
   Article to open a clean creation page.
3. Choose `HW Exclusive` or `Branded`.
4. For Branded, choose Pret or Unstitched and select an approved official brand
   name. Known aliases are normalized to the official name without AI. If the
   name is missing or its spelling is uncertain, finish typing and select
   `AI Suggestions`; no request is made while typing. Selecting one returned
   name approves and saves it for reuse, then the article can be saved. Choose
   `Other Brands` for a genuine manually sourced article whose original brand
   should not be identified publicly.
5. Select or drag up to eight main/gallery article pictures at once as JPG, PNG
   or WebP (Command-click on Mac or Ctrl-click on Windows selects separate
   files), then add title, article code, description, pieces, fabric, season, garment
   details, care, buying cost and selling price. Existing hosted URLs may still
   be pasted when necessary.
6. For Pret, add stock per size and article measurements. For unstitched, add
   total stock quantity and fabric/piece details.
7. Save as a draft or add and publish after review.
8. Later open its details page to edit information and images, change the main
   picture, publish, remove from shop or delete it. Removing an uploaded picture
   or deleting the article also removes unreferenced Haley Wali image files.

Deleting is permanent. Unpublishing is the normal way to temporarily hide stock.
Store Manager sign-in is temporarily blocked after five incorrect password
attempts from the same network address within 15 minutes.

## Imported supplier article flow

1. Open Store Manager -> Supplier Import to see the imported-article list.
2. Run Import Now, or run the local import command.
3. New supplier articles appear as private Branded Pret drafts in the list.
4. Select one row to open only that article's price and publication details.
5. Enter the actual wholesale buying cost. Do not use supplier display price as
   the buying cost unless it matches the invoice.
6. Review the suggested price, then set the final selling price.
7. Choose supply mode:
   - `on_demand`: keep it as a private supplier draft while deciding whether to
     buy it;
   - `owned_stock`: public only while Haley Wali stock is greater than zero.
8. Review public title, images and variants. For owned stock, enter the exact
   quantity held in each available size rather than only one total quantity.
9. Publish manually. Publishing owned stock preserves the public article ID,
   converts it into the normal Articles workflow, deletes its duplicate
   supplier/import rows, and opens the full article editor. It can then be
   edited, unpublished or deleted in Store Manager -> Articles like any other
   manually managed Branded article.

Later imports may refresh supplier title, images, sizes and availability for
unapproved supplier drafts. They must never overwrite Haley Wali buying cost,
selling price or publish decision. A converted owned article is skipped by
future imports while its normal Article record exists.

## Order fulfilment flow

1. A new order is saved as `received`.
2. The customer can send the free prefilled WhatsApp confirmation from the
   order-success page. The store manager reads it in WhatsApp and updates the
   saved order manually.
3. Store Manager -> Orders shows the order list. Select one row to open only
   that order's customer, address, articles, totals and status controls.
4. Store manager verifies stock and calls the customer if needed.
5. Order moves through `confirmed`, `packed`, `dispatched`, `delivered`, or
   `cancelled`.
6. Customer tracking shows the current stage.
7. A cancelled order may be permanently deleted from its detail page. Deletion
   removes its articles and any offer-redemption record only after cancellation
   has safely restored reserved stock.

Checkout now decreases stock. Moving an order to `cancelled` restores its stock
once; a cancelled order cannot be reopened. Active orders cannot be deleted.
Order totals keep the article
subtotal, any offer discount, the delivery amount charged on that order and the
final total.

## Offer code flow

1. Open Store Manager -> Offers, or add a new offer from `/offers/new`.
2. Set the public code, internal name, percent or fixed PKR discount, optional
   free delivery, and whether it applies to all articles, HW Exclusive or
   Branded.
3. Optionally add dates, a minimum subtotal, a maximum number of uses and one
   use per mobile number.
4. Leave the offer active, or turn it off without deleting it.
5. Customer enters the code in bag or checkout. The Worker previews the
   discount from D1 prices and the live delivery setting.
6. Checkout stores the code snapshot on the order and counts the use in the
   same database batch as the order insert.

Nationwide delivery PKR is edited on Store Manager Overview. It is the shop-wide
charge until an offer makes that order's delivery free.

## Automatic season-sale flow

1. Open Store Manager Overview and find Delivery and automatic sale.
2. Set the public sale name and whole-number percentage, then leave Sale is
   active enabled. The initial release defaults to Season End Sale at 10%.
3. Save settings. The Home sale slide, public article prices and new checkout
   calculations read the same D1 values.
4. Change the percentage at any time, or turn the sale off to restore normal
   displayed and charged article prices. Existing orders retain their saved
   unit-price snapshots.
5. Offer codes are not shown or accepted while the automatic sale is active;
   turn the automatic sale off before running a code-based promotion.

## Exchange, return and complaint flow

1. Customer opens Customer Care or the Exchange Policy page.
2. Customer selects exchange, return, complaint or question and enters contact,
   order/article and request details.
3. The API saves a request with an `HWR-...` number. Automatic owner email
   notifications are deferred to a later change.
4. Store Manager -> Customer Requests shows a list. Selecting one opens only
   that request's details.
5. The manager records `received`, `contacted`, `approved`, `resolved` or
   `rejected`.
6. The manager may permanently delete a request from its detail page after an
   explicit confirmation.

## Product review flow

1. A customer opens an article and selects a one-to-five-star rating.
2. The customer enters a display name and review; a short title and one customer
   photo are optional. The browser compresses a selected JPG, PNG or WebP photo
   to an optimized WebP before upload.
3. The API validates the article, review and optimized photo, uploads the photo
   to Supabase Storage, and saves the review as `pending`.
4. Store Manager -> Product Reviews shows the moderation queue.
5. The manager approves a suitable review, rejects it, or deletes it.
6. Only approved reviews and their optional photos appear publicly and
   contribute to the public review count and average.

## Failure expectations

- The order saves before the customer opens WhatsApp. Closing WhatsApp or not
  sending the prepared message must never delete or duplicate the saved order.
- If supplier import fails, keep existing articles and show the import error;
  never erase the catalog because of one failed run.
- If an article becomes unavailable between bag and checkout, checkout must
  reject that item and ask the customer to review the bag.
