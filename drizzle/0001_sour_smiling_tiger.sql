ALTER TABLE `ad_daily_stats` ADD `video_p25` integer;--> statement-breakpoint
ALTER TABLE `ad_daily_stats` ADD `video_p50` integer;--> statement-breakpoint
ALTER TABLE `ad_daily_stats` ADD `video_p75` integer;--> statement-breakpoint
ALTER TABLE `ad_daily_stats` ADD `video_p95` integer;--> statement-breakpoint
ALTER TABLE `ad_daily_stats` ADD `video_3s` integer;--> statement-breakpoint
ALTER TABLE `ad_daily_stats` ADD `thruplays` integer;--> statement-breakpoint
ALTER TABLE `adset_daily_stats` ADD `impressions` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `adset_daily_stats` ADD `clicks` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `adset_daily_stats` ADD `ctr` real;--> statement-breakpoint
ALTER TABLE `adset_daily_stats` ADD `cpm` real;--> statement-breakpoint
ALTER TABLE `adset_daily_stats` ADD `frequency` real;