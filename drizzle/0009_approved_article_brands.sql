CREATE TABLE `approved_article_brands` (
	`canonical_name` text PRIMARY KEY COLLATE NOCASE NOT NULL,
	`source` text DEFAULT 'ai_confirmed' NOT NULL,
	`created_at` text NOT NULL
);
