import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const suppliers = sqliteTable("suppliers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  collectionHandle: text("collection_handle").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  lastSyncedAt: text("last_synced_at"),
});

export const supplierProducts = sqliteTable(
  "supplier_products",
  {
    id: text("id").primaryKey(),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    externalId: text("external_id").notNull(),
    handle: text("handle").notNull(),
    title: text("title").notNull(),
    descriptionHtml: text("description_html").notNull().default(""),
    sourceUrl: text("source_url").notNull(),
    sourcePricePkr: integer("source_price_pkr").notNull(),
    compareAtPricePkr: integer("compare_at_price_pkr"),
    imageUrl: text("image_url"),
    galleryJson: text("gallery_json").notNull().default("[]"),
    variantsJson: text("variants_json").notNull().default("[]"),
    sourceAvailable: integer("source_available", { mode: "boolean" })
      .notNull()
      .default(true),
    sourceUpdatedAt: text("source_updated_at"),
    contentHash: text("content_hash").notNull(),
    firstSeenAt: text("first_seen_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
  },
  (table) => [
    uniqueIndex("supplier_products_supplier_external_uidx").on(
      table.supplierId,
      table.externalId,
    ),
    index("supplier_products_last_seen_idx").on(table.supplierId, table.lastSeenAt),
  ],
);

export const catalogProducts = sqliteTable(
  "catalog_products",
  {
    id: text("id").primaryKey(),
    supplierProductId: text("supplier_product_id")
      .notNull()
      .references(() => supplierProducts.id),
    category: text("category").notNull().default("pret"),
    publicTitle: text("public_title").notNull(),
    costPricePkr: integer("cost_price_pkr"),
    sellingPricePkr: integer("selling_price_pkr"),
    overheadPkr: integer("overhead_pkr").notNull().default(250),
    targetMarginBps: integer("target_margin_bps").notNull().default(2500),
    pricingStatus: text("pricing_status").notNull().default("awaiting_cost"),
    publishStatus: text("publish_status").notNull().default("draft"),
    supplyMode: text("supply_mode").notNull().default("on_demand"),
    stockQty: integer("stock_qty").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("catalog_products_supplier_product_uidx").on(table.supplierProductId),
    index("catalog_products_public_idx").on(
      table.category,
      table.publishStatus,
      table.sellingPricePkr,
    ),
  ],
);

export const importRuns = sqliteTable("import_runs", {
  id: text("id").primaryKey(),
  supplierId: text("supplier_id")
    .notNull()
    .references(() => suppliers.id),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  status: text("status").notNull(),
  discoveredCount: integer("discovered_count").notNull().default(0),
  insertedCount: integer("inserted_count").notNull().default(0),
  updatedCount: integer("updated_count").notNull().default(0),
  unchangedCount: integer("unchanged_count").notNull().default(0),
  errorMessage: text("error_message"),
});

export const manualProducts = sqliteTable(
  "manual_products",
  {
    id: text("id").primaryKey(),
    collection: text("collection").notNull().default("exclusive"),
    garmentType: text("garment_type").notNull().default("unstitched"),
    brand: text("brand").notNull().default("Haley Wali"),
    publicTitle: text("public_title").notNull(),
    articleCode: text("article_code").notNull().default(""),
    subtitle: text("subtitle").notNull().default("Clothing Article"),
    description: text("description").notNull().default(""),
    imageUrl: text("image_url"),
    galleryJson: text("gallery_json").notNull().default("[]"),
    variantsJson: text("variants_json").notNull().default("[]"),
    pieces: text("pieces").notNull().default("1 Piece"),
    season: text("season").notNull().default("All Season"),
    fabric: text("fabric").notNull().default("See article details"),
    color: text("color").notNull().default("As shown"),
    care: text("care").notNull().default("Follow the care label"),
    shirtDetails: text("shirt_details").notNull().default(""),
    trouserDetails: text("trouser_details").notNull().default(""),
    dupattaDetails: text("dupatta_details").notNull().default(""),
    modelDetails: text("model_details").notNull().default(""),
    measurementsJson: text("measurements_json").notNull().default("[]"),
    includesJson: text("includes_json").notNull().default("[]"),
    costPricePkr: integer("cost_price_pkr"),
    sellingPricePkr: integer("selling_price_pkr"),
    publishStatus: text("publish_status").notNull().default("draft"),
    stockQty: integer("stock_qty").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("manual_products_public_idx").on(
      table.collection,
      table.publishStatus,
      table.sellingPricePkr,
    ),
  ],
);

export const approvedArticleBrands = sqliteTable("approved_article_brands", {
  canonicalName: text("canonical_name").primaryKey(),
  source: text("source").notNull().default("ai_confirmed"),
  createdAt: text("created_at").notNull(),
});

export const manualVariantStock = sqliteTable(
  "manual_variant_stock",
  {
    productId: text("product_id")
      .notNull()
      .references(() => manualProducts.id),
    size: text("size").notNull(),
    stockQty: integer("stock_qty").notNull().default(0),
  },
  (table) => [uniqueIndex("manual_variant_stock_product_size_uidx").on(table.productId, table.size)],
);

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    orderNumber: text("order_number").notNull().unique(),
    customerName: text("customer_name").notNull(),
    phone: text("phone").notNull(),
    address: text("address").notNull(),
    city: text("city").notNull(),
    postalCode: text("postal_code"),
    note: text("note"),
    subtotalPkr: integer("subtotal_pkr").notNull(),
    deliveryPkr: integer("delivery_pkr").notNull(),
    discountPkr: integer("discount_pkr").notNull().default(0),
    offerCode: text("offer_code"),
    totalPkr: integer("total_pkr").notNull(),
    paymentMethod: text("payment_method").notNull().default("Cash on Delivery"),
    status: text("status").notNull().default("received"),
    postexTrackingNumber: text("postex_tracking_number"),
    whatsappStatus: text("whatsapp_status").notNull().default("not_configured"),
    checkoutToken: text("checkout_token").unique(),
    stockRestored: integer("stock_restored", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("orders_lookup_idx").on(table.orderNumber, table.phone)],
);

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  productId: text("product_id").notNull(),
  title: text("title").notNull(),
  size: text("size").notNull(),
  quantity: integer("quantity").notNull(),
  unitPricePkr: integer("unit_price_pkr").notNull(),
});

export const customerRequests = sqliteTable(
  "customer_requests",
  {
    id: text("id").primaryKey(),
    requestNumber: text("request_number").notNull().unique(),
    type: text("type").notNull(),
    orderNumber: text("order_number"),
    customerName: text("customer_name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    articleName: text("article_name"),
    reason: text("reason").notNull(),
    details: text("details").notNull(),
    status: text("status").notNull().default("received"),
    whatsappStatus: text("whatsapp_status").notNull().default("not_configured"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("customer_requests_status_idx").on(table.status, table.createdAt)],
);

export const adminLoginAttempts = sqliteTable("admin_login_attempts", {
  ipHash: text("ip_hash").primaryKey(),
  windowStartedAt: integer("window_started_at").notNull(),
  failedCount: integer("failed_count").notNull().default(0),
  blockedUntil: integer("blocked_until").notNull().default(0),
});

export const storeSettings = sqliteTable("store_settings", {
  id: text("id").primaryKey(),
  deliveryPkr: integer("delivery_pkr").notNull().default(250),
  saleActive: integer("sale_active", { mode: "boolean" }).notNull().default(true),
  salePercent: integer("sale_percent").notNull().default(10),
  saleName: text("sale_name").notNull().default("Season End Sale"),
  saleDescription: text("sale_description").notNull().default("The reduced price is already shown across HW Exclusive and Branded articles. No sale code is needed."),
  updatedAt: text("updated_at").notNull(),
});

export const offerCodes = sqliteTable(
  "offer_codes",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    discountType: text("discount_type").notNull().default("percent"),
    discountValue: integer("discount_value").notNull().default(0),
    freeDelivery: integer("free_delivery", { mode: "boolean" }).notNull().default(false),
    appliesTo: text("applies_to").notNull().default("all"),
    minSubtotalPkr: integer("min_subtotal_pkr"),
    maxRedemptions: integer("max_redemptions"),
    redemptionCount: integer("redemption_count").notNull().default(0),
    perPhone: integer("per_phone", { mode: "boolean" }).notNull().default(false),
    startsAt: text("starts_at"),
    endsAt: text("ends_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("offer_codes_code_uidx").on(table.code)],
);

export const offerRedemptions = sqliteTable(
  "offer_redemptions",
  {
    id: text("id").primaryKey(),
    offerId: text("offer_id")
      .notNull()
      .references(() => offerCodes.id),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    phone: text("phone").notNull(),
    amountSavedPkr: integer("amount_saved_pkr").notNull(),
    perPhoneLock: integer("per_phone_lock", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("offer_redemptions_offer_order_uidx").on(table.offerId, table.orderId),
    index("offer_redemptions_phone_idx").on(table.offerId, table.phone),
  ],
);

export const productReviews = sqliteTable(
  "product_reviews",
  {
    id: text("id").primaryKey(),
    productId: text("product_id").notNull(),
    customerName: text("customer_name").notNull(),
    rating: integer("rating").notNull(),
    title: text("title").notNull().default(""),
    comment: text("comment").notNull(),
    imageUrl: text("image_url"),
    status: text("status").notNull().default("pending"),
    submitterHash: text("submitter_hash").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("product_reviews_public_idx").on(table.productId, table.status, table.createdAt),
    index("product_reviews_submitter_idx").on(table.submitterHash, table.createdAt),
  ],
);
