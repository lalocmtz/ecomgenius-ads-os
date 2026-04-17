CREATE TABLE `ad_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text NOT NULL,
	`source_id` text NOT NULL,
	`external_account_id` text,
	`display_name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `ad_sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ad_daily_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`ad_id` text NOT NULL,
	`date` text NOT NULL,
	`spend_usd` real DEFAULT 0 NOT NULL,
	`revenue_usd` real DEFAULT 0 NOT NULL,
	`purchases` integer DEFAULT 0 NOT NULL,
	`impressions` integer DEFAULT 0 NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL,
	`atc` integer DEFAULT 0 NOT NULL,
	`ic` integer DEFAULT 0 NOT NULL,
	`frequency` real,
	`ctr` real,
	`cpc` real,
	`cpm` real,
	`roas` real,
	`platform` text,
	`placement` text,
	`age_range` text,
	`gender` text,
	`region` text,
	`device` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`ad_id`) REFERENCES `ads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_ad_daily_stats_ad_date` ON `ad_daily_stats` (`ad_id`,`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `ad_daily_stats_ad_id_date_platform_placement_age_range_gender_region_device_unique` ON `ad_daily_stats` (`ad_id`,`date`,`platform`,`placement`,`age_range`,`gender`,`region`,`device`);--> statement-breakpoint
CREATE TABLE `ad_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`display_name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ads` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text NOT NULL,
	`adset_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`creative_url` text,
	`creative_video_url` text,
	`creative_analysis_id` text,
	`verdict` text,
	`verdict_reason` text,
	`killed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`adset_id`) REFERENCES `adsets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ads_verdict` ON `ads` (`verdict`);--> statement-breakpoint
CREATE INDEX `idx_ads_adset` ON `ads` (`adset_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ads_adset_id_external_id_unique` ON `ads` (`adset_id`,`external_id`);--> statement-breakpoint
CREATE TABLE `adset_daily_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`adset_id` text NOT NULL,
	`date` text NOT NULL,
	`spend_usd` real DEFAULT 0 NOT NULL,
	`revenue_usd` real DEFAULT 0 NOT NULL,
	`purchases` integer DEFAULT 0 NOT NULL,
	`roas` real,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`adset_id`) REFERENCES `adsets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `adset_daily_stats_adset_id_date_unique` ON `adset_daily_stats` (`adset_id`,`date`);--> statement-breakpoint
CREATE TABLE `adsets` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`campaign_name` text,
	`status` text NOT NULL,
	`daily_budget_usd` real,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `ad_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `adsets_account_id_external_id_unique` ON `adsets` (`account_id`,`external_id`);--> statement-breakpoint
CREATE TABLE `brand_economics` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text NOT NULL,
	`aov_mxn` real NOT NULL,
	`cogs_per_order_mxn` real NOT NULL,
	`shipping_mxn` real NOT NULL,
	`shopify_fee_mxn` real NOT NULL,
	`payment_fee_mxn` real NOT NULL,
	`target_margin_pct` real NOT NULL,
	`min_roas` real NOT NULL,
	`pieces_per_order` integer NOT NULL,
	`total_cost_per_order_mxn` real NOT NULL,
	`margin_per_order_mxn` real NOT NULL,
	`cac_target_usd` real NOT NULL,
	`cac_breakeven_usd` real NOT NULL,
	`test_threshold_usd` real NOT NULL,
	`aov_usd` real NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`effective_from` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `brands` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo_url` text,
	`currency_account` text NOT NULL,
	`currency_business` text NOT NULL,
	`exchange_rate` real NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brands_slug_unique` ON `brands` (`slug`);--> statement-breakpoint
CREATE TABLE `creative_analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`ad_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_url` text,
	`video_r2_key` text,
	`hook` text,
	`angle` text,
	`format` text,
	`visual_style` text,
	`pacing` text,
	`audio_type` text,
	`cta` text,
	`analysis_full` text NOT NULL,
	`recommendations` text NOT NULL,
	`cost_tokens_in` integer,
	`cost_tokens_out` integer,
	`model_used` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`ad_id`) REFERENCES `ads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `csv_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text NOT NULL,
	`source_id` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`filename` text NOT NULL,
	`date_range_start` text NOT NULL,
	`date_range_end` text NOT NULL,
	`rows_processed` integer NOT NULL,
	`rows_failed` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `ad_sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`body` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recommendations` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text NOT NULL,
	`upload_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`metrics_snapshot` text NOT NULL,
	`executed` integer DEFAULT 0 NOT NULL,
	`executed_at` integer,
	`executed_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`upload_id`) REFERENCES `csv_uploads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_recommendations_brand_upload` ON `recommendations` (`brand_id`,`upload_id`);