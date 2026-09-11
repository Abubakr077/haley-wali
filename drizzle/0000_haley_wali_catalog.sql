PRAGMA foreign_keys = ON;
--> statement-breakpoint
CREATE TABLE `suppliers` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `base_url` text NOT NULL,
  `collection_handle` text NOT NULL,
  `active` integer DEFAULT true NOT NULL,
  `last_synced_at` text
);
--> statement-breakpoint
CREATE TABLE `supplier_products` (
  `id` text PRIMARY KEY NOT NULL,
  `supplier_id` text NOT NULL,
  `external_id` text NOT NULL,
  `handle` text NOT NULL,
  `title` text NOT NULL,
  `description_html` text DEFAULT '' NOT NULL,
  `source_url` text NOT NULL,
  `source_price_pkr` integer NOT NULL,
  `compare_at_price_pkr` integer,
  `image_url` text,
  `gallery_json` text DEFAULT '[]' NOT NULL,
  `variants_json` text DEFAULT '[]' NOT NULL,
  `source_available` integer DEFAULT true NOT NULL,
  `source_updated_at` text,
  `content_hash` text NOT NULL,
  `first_seen_at` text NOT NULL,
  `last_seen_at` text NOT NULL,
  FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_products_supplier_external_uidx`
  ON `supplier_products` (`supplier_id`, `external_id`);
--> statement-breakpoint
CREATE INDEX `supplier_products_last_seen_idx`
  ON `supplier_products` (`supplier_id`, `last_seen_at`);
--> statement-breakpoint
CREATE TABLE `catalog_products` (
  `id` text PRIMARY KEY NOT NULL,
  `supplier_product_id` text NOT NULL,
  `category` text DEFAULT 'pret' NOT NULL,
  `public_title` text NOT NULL,
  `cost_price_pkr` integer,
  `selling_price_pkr` integer,
  `overhead_pkr` integer DEFAULT 250 NOT NULL,
  `target_margin_bps` integer DEFAULT 2500 NOT NULL,
  `pricing_status` text DEFAULT 'awaiting_cost' NOT NULL,
  `publish_status` text DEFAULT 'draft' NOT NULL,
  `supply_mode` text DEFAULT 'on_demand' NOT NULL,
  `stock_qty` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`supplier_product_id`) REFERENCES `supplier_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_products_supplier_product_uidx`
  ON `catalog_products` (`supplier_product_id`);
--> statement-breakpoint
CREATE INDEX `catalog_products_public_idx`
  ON `catalog_products` (`category`, `publish_status`, `selling_price_pkr`);
--> statement-breakpoint
CREATE TABLE `import_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `supplier_id` text NOT NULL,
  `started_at` text NOT NULL,
  `finished_at` text,
  `status` text NOT NULL,
  `discovered_count` integer DEFAULT 0 NOT NULL,
  `inserted_count` integer DEFAULT 0 NOT NULL,
  `updated_count` integer DEFAULT 0 NOT NULL,
  `unchanged_count` integer DEFAULT 0 NOT NULL,
  `error_message` text,
  FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
