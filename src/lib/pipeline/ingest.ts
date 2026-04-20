/**
 * Ingestion pipeline — PRD §6.2.
 *
 * Takes the output of a CSV parser and:
 *   1. Upserts adsets and ads (by external_id within account).
 *   2. Inserts / upserts rows into ad_daily_stats.
 *   3. Recomputes adset_daily_stats from ad_daily_stats.
 *   4. Runs the rules engine over ALL ads and adsets of the brand.
 *   5. Persists `recommendations` rows and `csv_uploads` bookkeeping.
 *
 * All hot loops use batched SQL to stay within Vercel's 10s function limit.
 */

import { and, eq, sql, inArray } from "drizzle-orm";
import type { db as Db } from "@/lib/db/client";
import {
  ads,
  adsets,
  adDailyStats,
  adsetDailyStats,
  adAccounts,
  brandEconomics,
  brands,
  csvUploads,
  recommendations,
} from "@/lib/db/schema";
import { newId } from "@/lib/utils/id";
import type { MetaRow } from "@/lib/parsers/meta-csv";
import {
  buildRecommendations,
  type AdInput,
  type AdsetInput,
} from "@/lib/rules-engine/recommendations";
import { calculateBrandThresholds } from "@/lib/rules-engine/thresholds";
import type { BrandThresholds } from "@/lib/rules-engine/types";

export interface IngestArgs {
  db: typeof Db;
  brandId: string;
  accountId: string;
  sourceId: string;
  uploadedBy: string;
  filename: string;
  rows: MetaRow[];
}

export interface IngestResult {
  uploadId: string;
  adsetsUpserted: number;
  adsUpserted: number;
  statsInserted: number;
  recommendations: {
    ads: number;
    adsets: number;
  };
  thresholds: BrandThresholds;
  dateRange: { start: string; end: string };
}

const BATCH = 200; // rows per INSERT statement (safe for SQLite param limits)

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function ingestMetaRows(args: IngestArgs): Promise<IngestResult> {
  const { db, brandId, accountId, sourceId, uploadedBy, filename, rows } = args;

  if (rows.length === 0) throw new Error("No rows to ingest");

  const dateRange = {
    start: rows.reduce((m, r) => (r.date < m ? r.date : m), rows[0]!.date),
    end: rows.reduce((m, r) => (r.date > m ? r.date : m), rows[0]!.date),
  };

  // --- 1. Verify account ---
  const [account] = await db
    .select()
    .from(adAccounts)
    .where(and(eq(adAccounts.id, accountId), eq(adAccounts.brandId, brandId)))
    .limit(1);
  if (!account) throw new Error(`Account ${accountId} does not belong to brand ${brandId}`);

  // --- 2. Upsert adsets (bulk) ---
  const distinctAdsets = new Map<string, { name: string; campaign: string | null }>();
  for (const r of rows) {
    if (!distinctAdsets.has(r.adset_external_id)) {
      distinctAdsets.set(r.adset_external_id, { name: r.adset_name, campaign: r.campaign_name });
    }
  }

  const extAdsetIds = Array.from(distinctAdsets.keys());
  const existingAdsets =
    extAdsetIds.length > 0
      ? await db
          .select({ id: adsets.id, externalId: adsets.externalId, name: adsets.name })
          .from(adsets)
          .where(and(eq(adsets.accountId, accountId), inArray(adsets.externalId, extAdsetIds)))
      : [];

  const adsetIdMap = new Map<string, string>();
  const existingAdsetMap = new Map(existingAdsets.map((r) => [r.externalId, r]));
  let adsetsUpserted = 0;

  const newAdsets: (typeof adsets.$inferInsert)[] = [];
  for (const [extId, info] of distinctAdsets) {
    const existing = existingAdsetMap.get(extId);
    if (existing) {
      adsetIdMap.set(extId, existing.id);
      if (existing.name !== info.name) {
        await db
          .update(adsets)
          .set({ name: info.name, campaignName: info.campaign, updatedAt: new Date() })
          .where(eq(adsets.id, existing.id));
      }
    } else {
      const id = newId("adset");
      newAdsets.push({
        id,
        externalId: extId,
        accountId,
        name: info.name,
        campaignName: info.campaign,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      adsetIdMap.set(extId, id);
      adsetsUpserted++;
    }
  }
  for (const batch of chunks(newAdsets, BATCH)) {
    await db.insert(adsets).values(batch);
  }

  // --- 3. Upsert ads (bulk) ---
  const distinctAds = new Map<string, { adsetExt: string; name: string }>();
  for (const r of rows) {
    const key = `${r.adset_external_id}::${r.ad_external_id}`;
    if (!distinctAds.has(key)) {
      distinctAds.set(key, { adsetExt: r.adset_external_id, name: r.ad_name });
    }
  }

  const adsetInternalIds = Array.from(adsetIdMap.values());
  const existingAds =
    adsetInternalIds.length > 0
      ? await db
          .select({ id: ads.id, externalId: ads.externalId, adsetId: ads.adsetId, name: ads.name })
          .from(ads)
          .where(inArray(ads.adsetId, adsetInternalIds))
      : [];

  const existingAdMap = new Map(existingAds.map((r) => [`${r.adsetId}::${r.externalId}`, r]));
  const adIdMap = new Map<string, string>(); // "adsetExtId::adExtId" → internal id
  let adsUpserted = 0;

  const newAds: (typeof ads.$inferInsert)[] = [];
  for (const [key, info] of distinctAds) {
    const adsetInternalId = adsetIdMap.get(info.adsetExt)!;
    const extAdId = key.split("::")[1]!;
    const lookupKey = `${adsetInternalId}::${extAdId}`;
    const existing = existingAdMap.get(lookupKey);
    if (existing) {
      adIdMap.set(key, existing.id);
      if (existing.name !== info.name) {
        await db
          .update(ads)
          .set({ name: info.name, updatedAt: new Date() })
          .where(eq(ads.id, existing.id));
      }
    } else {
      const id = newId("ad");
      newAds.push({
        id,
        externalId: extAdId,
        adsetId: adsetInternalId,
        name: info.name,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      adIdMap.set(key, id);
      adsUpserted++;
    }
  }
  for (const batch of chunks(newAds, BATCH)) {
    await db.insert(ads).values(batch);
  }

  // --- 4. Batch-insert ad_daily_stats ---
  const statValues: (typeof adDailyStats.$inferInsert)[] = rows.map((r) => {
    const adKey = `${r.adset_external_id}::${r.ad_external_id}`;
    return {
      id: newId("stat"),
      adId: adIdMap.get(adKey)!,
      date: r.date,
      spendUsd: r.spend_usd,
      revenueUsd: r.revenue_usd,
      purchases: r.purchases,
      impressions: r.impressions,
      clicks: r.clicks,
      atc: r.atc,
      ic: r.ic,
      frequency: r.frequency,
      ctr: r.ctr,
      cpc: r.cpc,
      cpm: r.cpm,
      roas: r.spend_usd > 0 ? r.revenue_usd / r.spend_usd : null,
      videoP25: r.video_p25,
      videoP50: r.video_p50,
      videoP75: r.video_p75,
      videoP95: r.video_p95,
      video3s: r.video_3s,
      thruplays: r.thruplays,
      platform: r.platform,
      placement: r.placement,
      ageRange: r.age_range,
      gender: r.gender,
      region: r.region,
      device: r.device,
      createdAt: new Date(),
    };
  });

  const conflictCols = [
    adDailyStats.adId,
    adDailyStats.date,
    adDailyStats.platform,
    adDailyStats.placement,
    adDailyStats.ageRange,
    adDailyStats.gender,
    adDailyStats.region,
    adDailyStats.device,
  ];

  for (const batch of chunks(statValues, BATCH)) {
    await db
      .insert(adDailyStats)
      .values(batch)
      .onConflictDoUpdate({
        target: conflictCols,
        set: {
          spendUsd: sql`excluded.spend_usd`,
          revenueUsd: sql`excluded.revenue_usd`,
          purchases: sql`excluded.purchases`,
          impressions: sql`excluded.impressions`,
          clicks: sql`excluded.clicks`,
          atc: sql`excluded.atc`,
          ic: sql`excluded.ic`,
          frequency: sql`excluded.frequency`,
          ctr: sql`excluded.ctr`,
          cpc: sql`excluded.cpc`,
          cpm: sql`excluded.cpm`,
          roas: sql`excluded.roas`,
          videoP25: sql`excluded.video_p25`,
          videoP50: sql`excluded.video_p50`,
          videoP75: sql`excluded.video_p75`,
          videoP95: sql`excluded.video_p95`,
          video3s: sql`excluded.video_3s`,
          thruplays: sql`excluded.thruplays`,
        },
      });
  }

  // --- 5. Recompute adset_daily_stats (single aggregate query) ---
  const adIdList = Array.from(adIdMap.values());
  const aggRows = await db
    .select({
      adsetId: ads.adsetId,
      date: adDailyStats.date,
      spendUsd: sql<number>`SUM(${adDailyStats.spendUsd})`.as("spend"),
      revenueUsd: sql<number>`SUM(${adDailyStats.revenueUsd})`.as("rev"),
      purchases: sql<number>`SUM(${adDailyStats.purchases})`.as("p"),
      impressions: sql<number>`COALESCE(SUM(${adDailyStats.impressions}), 0)`.as("imp"),
      clicks: sql<number>`COALESCE(SUM(${adDailyStats.clicks}), 0)`.as("clk"),
      freqNum: sql<number | null>`SUM(${adDailyStats.frequency} * ${adDailyStats.impressions})`.as("fn"),
    })
    .from(adDailyStats)
    .innerJoin(ads, eq(ads.id, adDailyStats.adId))
    .where(inArray(adDailyStats.adId, adIdList))
    .groupBy(ads.adsetId, adDailyStats.date);

  const adsetStatValues: (typeof adsetDailyStats.$inferInsert)[] = aggRows.map((a) => {
    const ctr = a.impressions > 0 ? a.clicks / a.impressions : null;
    const cpm = a.impressions > 0 ? (a.spendUsd * 1000) / a.impressions : null;
    const frequency = a.freqNum !== null && a.impressions > 0 ? a.freqNum / a.impressions : null;
    return {
      id: newId("astat"),
      adsetId: a.adsetId,
      date: a.date,
      spendUsd: a.spendUsd,
      revenueUsd: a.revenueUsd,
      purchases: a.purchases,
      impressions: a.impressions,
      clicks: a.clicks,
      ctr,
      cpm,
      frequency,
      roas: a.spendUsd > 0 ? a.revenueUsd / a.spendUsd : null,
      createdAt: new Date(),
    };
  });

  for (const batch of chunks(adsetStatValues, BATCH)) {
    await db
      .insert(adsetDailyStats)
      .values(batch)
      .onConflictDoUpdate({
        target: [adsetDailyStats.adsetId, adsetDailyStats.date],
        set: {
          spendUsd: sql`excluded.spend_usd`,
          revenueUsd: sql`excluded.revenue_usd`,
          purchases: sql`excluded.purchases`,
          impressions: sql`excluded.impressions`,
          clicks: sql`excluded.clicks`,
          ctr: sql`excluded.ctr`,
          cpm: sql`excluded.cpm`,
          frequency: sql`excluded.frequency`,
          roas: sql`excluded.roas`,
        },
      });
  }

  // --- 6. Brand economics + thresholds ---
  const [econ] = await db
    .select()
    .from(brandEconomics)
    .where(eq(brandEconomics.brandId, brandId))
    .orderBy(sql`${brandEconomics.version} DESC`)
    .limit(1);
  if (!econ) throw new Error(`Brand ${brandId} has no economics configured`);

  const [brandRow] = await db
    .select({ exchangeRate: brands.exchangeRate })
    .from(brands)
    .where(eq(brands.id, brandId))
    .limit(1);
  if (!brandRow) throw new Error(`Brand ${brandId} not found`);

  const thresholds = calculateBrandThresholds({
    aov_mxn: econ.aovMxn,
    cogs_per_order_mxn: econ.cogsPerOrderMxn,
    shipping_mxn: econ.shippingMxn,
    shopify_fee_mxn: econ.shopifyFeeMxn,
    payment_fee_mxn: econ.paymentFeeMxn,
    target_margin_pct: econ.targetMarginPct,
    min_roas: econ.minRoas,
    pieces_per_order: econ.piecesPerOrder,
    exchange_rate: brandRow.exchangeRate,
  });

  // --- 7. Rules engine — single aggregate query per entity type ---
  const allAdsOfBrand = await db
    .select({
      adId: ads.id,
      killedAt: ads.killedAt,
      spend: sql<number>`COALESCE(SUM(${adDailyStats.spendUsd}), 0)`.as("spend"),
      revenue: sql<number>`COALESCE(SUM(${adDailyStats.revenueUsd}), 0)`.as("rev"),
      purchases: sql<number>`COALESCE(SUM(${adDailyStats.purchases}), 0)`.as("p"),
      frequency: sql<number | null>`MAX(${adDailyStats.frequency})`.as("freq"),
      days: sql<number>`COUNT(DISTINCT ${adDailyStats.date})`.as("days"),
      daysAboveMin: sql<number>`COUNT(DISTINCT CASE WHEN ${adDailyStats.roas} >= ${thresholds.min_roas} THEN ${adDailyStats.date} END)`.as("dam"),
    })
    .from(ads)
    .innerJoin(adsets, eq(adsets.id, ads.adsetId))
    .leftJoin(adDailyStats, eq(adDailyStats.adId, ads.id))
    .where(eq(adsets.accountId, accountId))
    .groupBy(ads.id);

  const adInputs: AdInput[] = allAdsOfBrand.map((r) => ({
    ad_id: r.adId,
    killed_history: !!r.killedAt,
    perf: {
      spend_usd: r.spend,
      revenue_usd: r.revenue,
      purchases: r.purchases,
      frequency: r.frequency ?? undefined,
      days_with_data: r.days,
      days_with_roas_above_min: Number(r.daysAboveMin),
    },
  }));

  const allAdsetsOfBrand = await db
    .select({
      adsetId: adsets.id,
      spend: sql<number>`COALESCE(SUM(${adsetDailyStats.spendUsd}), 0)`.as("s"),
      revenue: sql<number>`COALESCE(SUM(${adsetDailyStats.revenueUsd}), 0)`.as("r"),
      purchases: sql<number>`COALESCE(SUM(${adsetDailyStats.purchases}), 0)`.as("p"),
      days: sql<number>`COUNT(DISTINCT ${adsetDailyStats.date})`.as("d"),
      daysAboveMin: sql<number>`COUNT(DISTINCT CASE WHEN ${adsetDailyStats.roas} >= ${thresholds.min_roas} THEN ${adsetDailyStats.date} END)`.as("dam"),
      activeAds: sql<number>`COUNT(DISTINCT ${ads.id})`.as("aa"),
    })
    .from(adsets)
    .leftJoin(adsetDailyStats, eq(adsetDailyStats.adsetId, adsets.id))
    .leftJoin(ads, eq(ads.adsetId, adsets.id))
    .where(eq(adsets.accountId, accountId))
    .groupBy(adsets.id);

  const adsetInputs: AdsetInput[] = allAdsetsOfBrand.map((row) => ({
    adset_id: row.adsetId,
    perf: {
      total_spend_usd: row.spend,
      total_revenue_usd: row.revenue,
      total_purchases: row.purchases,
      days_with_data: row.days,
      days_with_roas_above_min: Number(row.daysAboveMin),
      active_ads_count: Number(row.activeAds),
    },
  }));

  const totalSpend = allAdsetsOfBrand.reduce((s, a) => s + a.spend, 0);
  const totalRev = allAdsetsOfBrand.reduce((s, a) => s + a.revenue, 0);
  const accountRoas = totalSpend > 0 ? totalRev / totalSpend : 0;

  const engineOutput = buildRecommendations({
    thresholds,
    ads: adInputs,
    adsets: adsetInputs,
    account_roas: accountRoas,
  });

  // --- 8. Persist upload record + recommendations + verdicts ---
  const uploadId = newId("upload");
  await db.insert(csvUploads).values({
    id: uploadId,
    brandId,
    sourceId,
    uploadedBy,
    filename,
    dateRangeStart: dateRange.start,
    dateRangeEnd: dateRange.end,
    rowsProcessed: rows.length,
    rowsFailed: 0,
    createdAt: new Date(),
  });

  const recValues: (typeof recommendations.$inferInsert)[] = [
    ...engineOutput.ads.map((rec) => ({
      id: newId("rec"),
      brandId,
      uploadId,
      entityType: "ad" as const,
      entityId: rec.ad_id,
      action: rec.action,
      reason: rec.reason,
      metricsSnapshot: JSON.stringify(rec.metrics),
      executed: 0,
      createdAt: new Date(),
    })),
    ...engineOutput.adsets.map((rec) => ({
      id: newId("rec"),
      brandId,
      uploadId,
      entityType: "adset" as const,
      entityId: rec.adset_id,
      action: rec.action.toLowerCase(),
      reason: rec.reason,
      metricsSnapshot: JSON.stringify({ ...rec.metrics, budget_change_pct: rec.budget_change_pct }),
      executed: 0,
      createdAt: new Date(),
    })),
  ];

  for (const batch of chunks(recValues, BATCH)) {
    await db.insert(recommendations).values(batch);
  }

  // Update verdict cache on ads (batched via individual updates — small N)
  for (const rec of engineOutput.ads) {
    await db
      .update(ads)
      .set({
        verdict: rec.verdict,
        verdictReason: rec.reason,
        killedAt:
          rec.verdict === "LOSER" || rec.verdict === "KILLED" ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(ads.id, rec.ad_id));
  }

  return {
    uploadId,
    adsetsUpserted,
    adsUpserted,
    statsInserted: statValues.length,
    recommendations: {
      ads: engineOutput.ads.length,
      adsets: engineOutput.adsets.length,
    },
    thresholds,
    dateRange,
  };
}
