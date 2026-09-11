CREATE TABLE `admin_login_attempts` (
  `ip_hash` text PRIMARY KEY NOT NULL,
  `window_started_at` integer NOT NULL,
  `failed_count` integer DEFAULT 0 NOT NULL,
  `blocked_until` integer DEFAULT 0 NOT NULL
);
