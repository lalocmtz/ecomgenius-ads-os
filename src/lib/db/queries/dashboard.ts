/**
 * Dashboard queries — adset/ad rollups scoped to a brand and date range.
 */

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  ads,
  adsets,
  adAccounts,
  adDailyStats,
  adsetDailyStats,
} from "@/lib/db/schema";

export interface DateRange {
  start: string; // YYYY-MM-DD inclusive
  end: string; // YYYY-MM-DD inclusive
}

export interface AdsetRow {
  adsetId: string;
  adsetName: string;
  campaignName: string | null;
  status: string;
  dailyBudgetUsd: number | null;
  spendUsd: number;
  revenueUsd: number;
  purchases: number;
  impressions: number;
  clicks: number;
  roas: number;
  ctr: number | null;
  cpm: number | null;
  frequency: number | null;
  daysWithData: number;
  daysWithRoasAboveMin: number;
}

export interface AdRow {
  adId: string;
  adsetId: string;
  adName: string;
  verdict: string | null;
  verdictReason: string | null;
  status: string;
  killedAt: Date | null;
  creativeUrl: string | null;
  creativeVideoUrl: string | null;
  spendUsd: number;
  revenueUsd: number;
  purchases: number;
  impressions: number;
  clicks: number;
  video3s: number | null;
  thruplays: number | null;
  videoP25: number | null;
  videoP50: number | null;
  videoP75: number | null;
  videoP95: number | null;
  frequency: number | null;
  roas: number;
  hookRatePct: number | null; // video_3s / impressions * 100
}

export interface BrandRollup {
  spendUsd: number;
  revenueUsd: number;
  purchases: number;
  impressions: number;
  clicks: number;
  roas: number;
}

/**
 * Aggregate adset performance across a date range.
 * Uses adset_daily_stats (already denormalized during ingest).
 */
export async function getAdsetsForBrand(
  brandId: string,
  range: DateRange,
  minRoas: number,
): Promise<AdsetRow[]> {
  const rows = await db
    .select({
      adsetId: adsets.id,
      adsetName: adsets.name,
      campaignName: adsets.campaignName,
      status: adsets.status,
      dailyBudgetUsd: adsets.dailyBudgetUsd,
      spendUsd: sql<number>`COALESCE(SUM(${adsetDailyStats.spendUsd}), 0)`.as("s"),
      revenueUsd: sql<number>`COALESCE(SUM(${adsetDailyStats.revenueUsd}), 0)`.as("r"),
      purchases: sql<number>`COALESCE(SUM(${adsetDailyStats.purchases}), 0)`.as("p"),
      impressions: sql<number>`COALESCE(SUM(${adsetDailyStats.impressions}), 0)`.as("imp"),
      clicks: sql<number>`COALESCE(SUM(${adsetDailyStats.clicks}), 0)`.as("clk"),
      freqNum: sql<number | null>`SUM(${adsetDailyStats.frequency} * ${adsetDailyStats.impressions})`.as("fn"),
      daysWithData: sql<number>`COUNT(DISTINCT ${adsetDailyStats.date})`.as("dwd"),
      daysWithRoasAboveMin: sql<number>`COUNT(DISTINCT CASE WHEN ${adsetDailyStats.roas} >= ${minRoas} THEN ${adsetDailyStats.date} END)`.as("dwram"),
    })
    .from(adsets)
    .innerJoin(adAccounts, eq(adAccounts.id, adsets.accountId))
    .leftJoin(
      adsetDailyStats,
      and(
        eq(adsetDailyStats.adsetId, adsets.id),
        gte(adsetDailyStats.date, range.start),
        lte(adsetDailyStats.date, range.end),
      ),
    )
    .where(eq(adAccounts.brandId, brandId))
    .groupBy(adsets.id)
    .orderBy(desc(sql`s`));

  return rows.map((r) => {
    const roas = r.spendUsd > 0 ? r.revenueUsd / r.spendUsd : 0;
    const ctr = r.impressions > 0 ? r.clicks / r.impressions : null;
    const cpm = r.impressions > 0 ? (r.spendUsd * 1000) / r.impressions : null;
    const frequency =
      r.freqNum !== null && r.impressions > 0 ? r.freqNum / r.impressions : null;
    return {
      adsetId: r.adsetId,
      adsetName: r.adsetName,
      campaignName: r.campaignName,
      status: r.status,
      dailyBudgetUsd: r.dailyBudgetUsd,
      spendUsd: r.spendUsd,
      revenueUsd: r.revenueUsd,
      purchases: r.purchases,
      impressions: r.impressions,
      clicks: r.clicks,
      roas,
      ctr,
      cpm,
      frequency,
      daysWithData: Number(r.daysWithData),
      daysWithRoasAboveMin: Number(r.daysWithRoasAboveMin),
    };
  });
}

/**
 * Aggregate ad performance across a date range, scoped to a brand.
 * Video fields are taken as SUM (each day's percentile contributes).
 */
export async function getAdsForBrand(
  brandId: string,
  range: DateRange,
): Promise<AdRow[]> {
  const rows = await db
    .select({
      adId: ads.id,
      adsetId: ads.adsetId,
      adName: ads.name,
      verdict: ads.verdict,
      verdictReason: ads.verdictReason,
      status: ads.status,
      killedAt: ads.killedAt,
      creativeUrl: ads.creativeUrl,
      creativeVideoUrl: ads.creativeVideoUrl,
      spendUsd: sql<number>`COALESCE(SUM(${adDailyStats.spendUsd}), 0)`.as("s"),
      revenueUsd: sql<number>`COALESCE(SUM(${adDailyStats.revenueUsd}), 0)`.as("r"),
      purchases: sql<number>`COALESCE(SUM(${adDailyStats.purchases}), 0)`.as("p"),
      impressions: sql<number>`COALESCE(SUM(${adDailyStats.impressions}), 0)`.as("imp"),
      clicks: sql<number>`COALESCE(SUM(${adDailyStats.clicks}), 0)`.as("clk"),
      video3s: sql<number | null>`SUM(${adDailyStats.video3s})`.as("v3"),
      thruplays: sql<number | null>`SUM(${adDailyStats.thruplays})`.as("vtp"),
      videoP25: sql<number | null>`SUM(${adDailyStats.videoP25})`.as("v25"),
      videoP50: sql<number | null>`SUM(${adDailyStats.videoP50})`.as("v50"),
      videoP75: sql<number | null>`SUM(${adDailyStats.videoP75})`.as("v75"),
      videoP95: sql<number | null>`SUM(${adDailyStats.videoP95})`.as("v95"),
      freqMax: sql<number | null>`MAX(${adDailyStats.frequency})`.as("fm"),
    })
    .from(ads)
    .innerJoin(adsets, eq(adsets.id, ads.adsetId))
    .innerJoin(adAccounts, eq(adAccounts.id, adsets.accountId))
    .leftJoin(
      adDailyStats,
      and(
        eq(adDailyStats.adId, ads.id),
        gte(adDailyStats.date, range.start),
        lte(adDailyStats.date, range.end),
      ),
    )
    .where(eq(adAccounts.brandId, brandId))
    .groupBy(ads.id);

  return rows.map((r) => {
    const roas = r.spendUsd > 0 ? r.revenueUsd / r.spendUsd : 0;
    const hookRatePct =
      r.video3s !== null && r.impressions > 0
        ? (r.video3s / r.impressions) * 100
        : null;
    return {
      adId: r.adId,
      adsetId: r.adsetId,
      adName: r.adName,
      verdict: r.verdict,
      verdictReason: r.verdictReason,
      status: r.status,
      killedAt: r.killedAt,
      creativeUrl: r.creativeUrl,
      creativeVideoUrl: r.creativeVideoUrl,
      spendUsd: r.spendUsd,
      revenueUsd: r.revenueUsd,
      purchases: r.purchases,
      impressions: r.impressions,
      clicks: r.clicks,
      video3s: r.video3s,
      thruplays: r.thruplays,
      videoP25: r.videoP25,
      videoP50: r.videoP50,
      videoP75: r.videoP75,
      videoP95: r.videoP95,
      frequency: r.freqMax,
      roas,
      hookRatePct,
    };
  });
}

export async function getBrandRollup(
  brandId: string,
  range: DateRange,
): Promise<BrandRollup> {
  const [row] = await db
    .select({
      spend: sql<number>`COALESCE(SUM(${adDailyStats.spendUsd}), 0)`.as("s"),
      revenue: sql<number>`COALESCE(SUM(${adDailyStats.revenueUsd}), 0)`.as("r"),
      purchases: sql<number>`COALESCE(SUM(${adDailyStats.purchases}), 0)`.as("p"),
      impressions: sql<number>`COALESCE(SUM(${adDailyStats.impressions}), 0)`.as("imp"),
      clicks: sql<number>`COALESCE(SUM(${adDailyStats.clicks}), 0)`.as("clk"),
    })
    .from(adDailyStats)
    .innerJoin(ads, eq(ads.id, adDailyStats.adId))
    .innerJoin(adsets, eq(adsets.id, ads.adsetId))
    .innerJoin(adAccounts, eq(adAccounts.id, adsets.accountId))
    .where(
      and(
        eq(adAccounts.brandId, brandId),
        gte(adDailyStats.date, range.start),
        lte(adDailyStats.date, range.end),
      ),
    );

  const r = row ?? { spend: 0, revenue: 0, purchases: 0, impressions: 0, clicks: 0 };
  return {
    spendUsd: r.spend,
    revenueUsd: r.revenue,
    purchases: r.purchases,
    impressions: r.impressions,
    clicks: r.clicks,
    roas: r.spend > 0 ? r.revenue / r.spend : 0,
  };
}

/**
 * Returns earliest date with any stats for a brand.
 * Used for "TOTAL" range to anchor the lower bound.
 */
export async function getBrandDateBounds(
  brandId: string,
): Promise<{ min: string | null; max: string | null }> {
  const [row] = await db
    .select({
      min: sql<string | null>`MIN(${adDailyStats.date})`.as("mn"),
      max: sql<string | null>`MAX(${adDailyStats.date})`.as("mx"),
    })
    .from(adDailyStats)
    .innerJoin(ads, eq(ads.id, adDailyStats.adId))
    .innerJoin(adsets, eq(adsets.id, ads.adsetId))
    .innerJoin(adAccounts, eq(adAccounts.id, adsets.accountId))
    .where(eq(adAccounts.brandId, brandId));

  return { min: row?.min ?? null, max: row?.max ?? null };
}
