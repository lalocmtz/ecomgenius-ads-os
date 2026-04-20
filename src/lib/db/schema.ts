/**
 * Database schema — EcomGenius Ads OS
 * Source of truth: PRD §4
 * Dialect: Turso (libSQL / SQLite)
 */

import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  unique,
} from "drizzle-orm/sqlite-core";

// --------------------------------------
// Brands
// --------------------------------------
export const brands = sqliteTable("brands", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  currencyAccount: text("currency_account").notNull(), // "USD"
  currencyBusiness: text("currency_business").notNull(), // "MXN"
  exchangeRate: real("exchange_rate").notNull(), // 17.50
  ownerId: text("owner_id").notNull(), // Clerk user_id
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// --------------------------------------
// Brand economics (versioned)
// --------------------------------------
export const brandEconomics = sqliteTable("brand_economics", {
  id: text("id").primaryKey(),
  brandId: text("brand_id")
    .notNull()
    .references(() => brands.id, { onDelete: "cascade" }),
  // Inputs
  aovMxn: real("aov_mxn").notNull(),
  cogsPerOrderMxn: real("cogs_per_order_mxn").notNull(),
  shippingMxn: real("shipping_mxn").notNull(),
  shopifyFeeMxn: real("shopify_fee_mxn").notNull(),
  paymentFeeMxn: real("payment_fee_mxn").notNull(),
  targetMarginPct: real("target_margin_pct").notNull(),
  minRoas: real("min_roas").notNull(),
  piecesPerOrder: integer("pieces_per_order").notNull(),
  // Derived (calculated on save)
  totalCostPerOrderMxn: real("total_cost_per_order_mxn").notNull(),
  marginPerOrderMxn: real("margin_per_order_mxn").notNull(),
  cacTargetUsd: real("cac_target_usd").notNull(),
  cacBreakevenUsd: real("cac_breakeven_usd").notNull(),
  testThresholdUsd: real("test_threshold_usd").notNull(),
  aovUsd: real("aov_usd").notNull(),
  // Metadata
  version: integer("version").notNull().default(1),
  effectiveFrom: integer("effective_from", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// --------------------------------------
// Ad sources
// --------------------------------------
export const adSources = sqliteTable("ad_sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(), // "meta" | "tiktok"
  displayName: text("display_name").notNull(),
});

// --------------------------------------
// Ad accounts (brand + source)
// --------------------------------------
export const adAccounts = sqliteTable("ad_accounts", {
  id: text("id").primaryKey(),
  brandId: text("brand_id")
    .notNull()
    .references(() => brands.id, { onDelete: "cascade" }),
  sourceId: text("source_id")
    .notNull()
    .references(() => adSources.id),
  externalAccountId: text("external_account_id"),
  displayName: text("display_name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// --------------------------------------
// Adsets
// --------------------------------------
export const adsets = sqliteTable(
  "adsets",
  {
    id: text("id").primaryKey(),
    externalId: text("external_id").notNull(),
    accountId: text("account_id")
      .notNull()
      .references(() => adAccounts.id),
    name: text("name").notNull(),
    campaignName: text("campaign_name"),
    status: text("status").notNull(), // 'active' | 'paused' | 'archived'
    dailyBudgetUsd: real("daily_budget_usd"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    adsetAccountExtUnique: unique().on(t.accountId, t.externalId),
  }),
);

// --------------------------------------
// Ads
// --------------------------------------
export const ads = sqliteTable(
  "ads",
  {
    id: text("id").primaryKey(),
    externalId: text("external_id").notNull(),
    adsetId: text("adset_id")
      .notNull()
      .references(() => adsets.id),
    name: text("name").notNull(),
    status: text("status").notNull(),
    creativeUrl: text("creative_url"),
    creativeVideoUrl: text("creative_video_url"),
    creativeAnalysisId: text("creative_analysis_id"),
    // Derived by rules engine
    verdict: text("verdict"), // AdVerdict
    verdictReason: text("verdict_reason"),
    killedAt: integer("killed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    adsetExtUnique: unique().on(t.adsetId, t.externalId),
    verdictIdx: index("idx_ads_verdict").on(t.verdict),
    adsetIdx: index("idx_ads_adset").on(t.adsetId),
  }),
);

// --------------------------------------
// Ad daily stats (breakdown-aware)
// --------------------------------------
export const adDailyStats = sqliteTable(
  "ad_daily_stats",
  {
    id: text("id").primaryKey(),
    adId: text("ad_id")
      .notNull()
      .references(() => ads.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD
    spendUsd: real("spend_usd").notNull().default(0),
    revenueUsd: real("revenue_usd").notNull().default(0),
    purchases: integer("purchases").notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    atc: integer("atc").notNull().default(0),
    ic: integer("ic").notNull().default(0),
    frequency: real("frequency"),
    ctr: real("ctr"),
    cpc: real("cpc"),
    cpm: real("cpm"),
    roas: real("roas"),
    // Video engagement (nullable — depend on CSV export options)
    videoP25: integer("video_p25"),
    videoP50: integer("video_p50"),
    videoP75: integer("video_p75"),
    videoP95: integer("video_p95"),
    video3s: integer("video_3s"),
    thruplays: integer("thruplays"),
    // Breakdowns (nullable — depend on CSV export options)
    platform: text("platform"),
    placement: text("placement"),
    ageRange: text("age_range"),
    gender: text("gender"),
    region: text("region"),
    device: text("device"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    uniqBreakdown: unique().on(
      t.adId,
      t.date,
      t.platform,
      t.placement,
      t.ageRange,
      t.gender,
      t.region,
      t.device,
    ),
    adDateIdx: index("idx_ad_daily_stats_ad_date").on(t.adId, t.date),
  }),
);

// --------------------------------------
// Adset daily stats (aggregated)
// --------------------------------------
export const adsetDailyStats = sqliteTable(
  "adset_daily_stats",
  {
    id: text("id").primaryKey(),
    adsetId: text("adset_id")
      .notNull()
      .references(() => adsets.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    spendUsd: real("spend_usd").notNull().default(0),
    revenueUsd: real("revenue_usd").notNull().default(0),
    purchases: integer("purchases").notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    ctr: real("ctr"),
    cpm: real("cpm"),
    frequency: real("frequency"),
    roas: real("roas"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    uniq: unique().on(t.adsetId, t.date),
  }),
);

// --------------------------------------
// CSV uploads
// --------------------------------------
export const csvUploads = sqliteTable("csv_uploads", {
  id: text("id").primaryKey(),
  brandId: text("brand_id")
    .notNull()
    .references(() => brands.id),
  sourceId: text("source_id")
    .notNull()
    .references(() => adSources.id),
  uploadedBy: text("uploaded_by").notNull(),
  filename: text("filename").notNull(),
  dateRangeStart: text("date_range_start").notNull(),
  dateRangeEnd: text("date_range_end").notNull(),
  rowsProcessed: integer("rows_processed").notNull(),
  rowsFailed: integer("rows_failed").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// --------------------------------------
// Creative analyses (Claude API output)
// --------------------------------------
export const creativeAnalyses = sqliteTable("creative_analyses", {
  id: text("id").primaryKey(),
  adId: text("ad_id")
    .notNull()
    .references(() => ads.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(), // 'link' | 'upload'
  sourceUrl: text("source_url"),
  videoR2Key: text("video_r2_key"),
  // Structured fields from Claude
  hook: text("hook"),
  angle: text("angle"),
  format: text("format"),
  visualStyle: text("visual_style"),
  pacing: text("pacing"),
  audioType: text("audio_type"),
  cta: text("cta"),
  analysisFull: text("analysis_full").notNull(), // JSON
  recommendations: text("recommendations").notNull(), // JSON
  costTokensIn: integer("cost_tokens_in"),
  costTokensOut: integer("cost_tokens_out"),
  modelUsed: text("model_used").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// --------------------------------------
// Recommendations (log per upload)
// --------------------------------------
export const recommendations = sqliteTable(
  "recommendations",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brands.id),
    uploadId: text("upload_id")
      .notNull()
      .references(() => csvUploads.id),
    entityType: text("entity_type").notNull(), // 'ad' | 'adset'
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(), // 'kill'|'keep'|'scale'|'descale'|'rotate'|'let_run'|'iterate'|'pause'|'hold'|'test_new_creatives'
    reason: text("reason").notNull(),
    metricsSnapshot: text("metrics_snapshot").notNull(), // JSON
    executed: integer("executed").notNull().default(0),
    executedAt: integer("executed_at", { mode: "timestamp_ms" }),
    executedBy: text("executed_by"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    brandUploadIdx: index("idx_recommendations_brand_upload").on(
      t.brandId,
      t.uploadId,
    ),
  }),
);

// --------------------------------------
// Notes (operational comments)
// --------------------------------------
export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  brandId: text("brand_id")
    .notNull()
    .references(() => brands.id),
  entityType: text("entity_type").notNull(), // 'ad'|'adset'|'brand'
  entityId: text("entity_id").notNull(),
  body: text("body").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// --------------------------------------
// Types (inferred from schema)
// --------------------------------------
export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
export type BrandEconomics = typeof brandEconomics.$inferSelect;
export type NewBrandEconomics = typeof brandEconomics.$inferInsert;
export type AdAccount = typeof adAccounts.$inferSelect;
export type Adset = typeof adsets.$inferSelect;
export type NewAdset = typeof adsets.$inferInsert;
export type Ad = typeof ads.$inferSelect;
export type NewAd = typeof ads.$inferInsert;
export type AdDailyStat = typeof adDailyStats.$inferSelect;
export type NewAdDailyStat = typeof adDailyStats.$inferInsert;
export type AdsetDailyStat = typeof adsetDailyStats.$inferSelect;
export type NewAdsetDailyStat = typeof adsetDailyStats.$inferInsert;
export type CsvUpload = typeof csvUploads.$inferSelect;
export type CreativeAnalysis = typeof creativeAnalyses.$inferSelect;
export type Recommendation = typeof recommendations.$inferSelect;
export type Note = typeof notes.$inferSelect;
