CREATE TABLE `store_settings` (
  `id` text PRIMARY KEY NOT NULL,
  `delivery_pkr` integer DEFAULT 250 NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `store_settings` (`id`, `delivery_pkr`, `updated_at`)
  VALUES ('default', 250, '2026-08-18T00:00:00.000Z');
--> statement-breakpoint
CREATE TABLE `offer_codes` (
  `id` text PRIMARY KEY NOT NULL,
  `code` text NOT NULL,
  `name` text NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `discount_type` text DEFAULT 'percent' NOT NULL,
  `discount_value` integer DEFAULT 0 NOT NULL,
  `free_delivery` integer DEFAULT 0 NOT NULL,
  `applies_to` text DEFAULT 'all' NOT NULL,
  `min_subtotal_pkr` integer,
  `max_redemptions` integer,
  `redemption_count` integer DEFAULT 0 NOT NULL,
  `per_phone` integer DEFAULT 0 NOT NULL,
  `starts_at` text,
  `ends_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `offer_codes_code_uidx` ON `offer_codes` (`code`);
--> statement-breakpoint
CREATE TABLE `offer_redemptions` (
  `id` text PRIMARY KEY NOT NULL,
  `offer_id` text NOT NULL REFERENCES `offer_codes`(`id`),
  `order_id` text NOT NULL REFERENCES `orders`(`id`),
  `phone` text NOT NULL,
  `amount_saved_pkr` integer NOT NULL,
  `per_phone_lock` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `offer_redemptions_offer_order_uidx`
  ON `offer_redemptions` (`offer_id`, `order_id`);
--> statement-breakpoint
CREATE INDEX `offer_redemptions_phone_idx`
  ON `offer_redemptions` (`offer_id`, `phone`);
--> statement-breakpoint
CREATE UNIQUE INDEX `offer_redemptions_per_phone_uidx`
  ON `offer_redemptions` (`offer_id`, `phone`)
  WHERE `per_phone_lock` = 1;
--> statement-breakpoint
ALTER TABLE `orders` ADD `discount_pkr` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `orders` ADD `offer_code` text;
