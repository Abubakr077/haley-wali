ALTER TABLE `manual_products` ADD `article_code` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `manual_products` ADD `season` text DEFAULT 'All Season' NOT NULL;
--> statement-breakpoint
ALTER TABLE `manual_products` ADD `shirt_details` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `manual_products` ADD `trouser_details` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `manual_products` ADD `dupatta_details` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `manual_products` ADD `model_details` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `manual_products` ADD `measurements_json` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
CREATE TABLE `manual_variant_stock` (
  `product_id` text NOT NULL,
  `size` text NOT NULL,
  `stock_qty` integer DEFAULT 0 NOT NULL,
  FOREIGN KEY (`product_id`) REFERENCES `manual_products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `manual_variant_stock_product_size_uidx`
  ON `manual_variant_stock` (`product_id`, `size`);
--> statement-breakpoint
ALTER TABLE `orders` ADD `checkout_token` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD `stock_restored` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_checkout_token_uidx` ON `orders` (`checkout_token`);
--> statement-breakpoint
CREATE TABLE `customer_requests` (
  `id` text PRIMARY KEY NOT NULL,
  `request_number` text NOT NULL UNIQUE,
  `type` text NOT NULL,
  `order_number` text,
  `customer_name` text NOT NULL,
  `phone` text NOT NULL,
  `email` text,
  `article_name` text,
  `reason` text NOT NULL,
  `details` text NOT NULL,
  `status` text DEFAULT 'received' NOT NULL,
  `whatsapp_status` text DEFAULT 'not_configured' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customer_requests_status_idx`
  ON `customer_requests` (`status`, `created_at`);
