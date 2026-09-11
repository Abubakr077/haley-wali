CREATE TABLE `product_reviews` (
  `id` text PRIMARY KEY NOT NULL,
  `product_id` text NOT NULL,
  `customer_name` text NOT NULL,
  `rating` integer NOT NULL,
  `title` text DEFAULT '' NOT NULL,
  `comment` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `submitter_hash` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `product_reviews_public_idx`
  ON `product_reviews` (`product_id`, `status`, `created_at`);
--> statement-breakpoint
CREATE INDEX `product_reviews_submitter_idx`
  ON `product_reviews` (`submitter_hash`, `created_at`);
