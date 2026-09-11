ALTER TABLE `store_settings` ADD `sale_active` integer DEFAULT 1 NOT NULL;
ALTER TABLE `store_settings` ADD `sale_percent` integer DEFAULT 10 NOT NULL;
ALTER TABLE `store_settings` ADD `sale_name` text DEFAULT 'Season End Sale' NOT NULL;
