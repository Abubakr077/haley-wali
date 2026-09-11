CREATE TABLE `manual_products` (
  `id` text PRIMARY KEY NOT NULL,
  `collection` text DEFAULT 'exclusive' NOT NULL,
  `garment_type` text DEFAULT 'unstitched' NOT NULL,
  `brand` text DEFAULT 'Haley Wali' NOT NULL,
  `public_title` text NOT NULL,
  `subtitle` text DEFAULT 'Clothing Article' NOT NULL,
  `description` text DEFAULT '' NOT NULL,
  `image_url` text,
  `gallery_json` text DEFAULT '[]' NOT NULL,
  `variants_json` text DEFAULT '[]' NOT NULL,
  `pieces` text DEFAULT '1 Piece' NOT NULL,
  `fabric` text DEFAULT 'See article details' NOT NULL,
  `color` text DEFAULT 'As shown' NOT NULL,
  `care` text DEFAULT 'Follow the care label' NOT NULL,
  `includes_json` text DEFAULT '[]' NOT NULL,
  `cost_price_pkr` integer,
  `selling_price_pkr` integer,
  `publish_status` text DEFAULT 'draft' NOT NULL,
  `stock_qty` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `manual_products_public_idx`
  ON `manual_products` (`collection`, `publish_status`, `selling_price_pkr`);
--> statement-breakpoint
CREATE TABLE `orders` (
  `id` text PRIMARY KEY NOT NULL,
  `order_number` text NOT NULL UNIQUE,
  `customer_name` text NOT NULL,
  `phone` text NOT NULL,
  `address` text NOT NULL,
  `city` text NOT NULL,
  `postal_code` text,
  `note` text,
  `subtotal_pkr` integer NOT NULL,
  `delivery_pkr` integer NOT NULL,
  `total_pkr` integer NOT NULL,
  `payment_method` text DEFAULT 'Cash on Delivery' NOT NULL,
  `status` text DEFAULT 'received' NOT NULL,
  `whatsapp_status` text DEFAULT 'not_configured' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `orders_lookup_idx` ON `orders` (`order_number`, `phone`);
--> statement-breakpoint
CREATE TABLE `order_items` (
  `id` text PRIMARY KEY NOT NULL,
  `order_id` text NOT NULL,
  `product_id` text NOT NULL,
  `title` text NOT NULL,
  `size` text NOT NULL,
  `quantity` integer NOT NULL,
  `unit_price_pkr` integer NOT NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
