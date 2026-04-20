/**
 * Ingestion pipeline — PRD §6.2.
 *
 * Takes the output of a CSV parser and:
 *   1. Upserts adsets and ads (by external_id within account).
 *   2. Inserts / upserts rows into ad_daily_stats.
 *   3. Recomputes adset_daily_stats from ad_daily_stats.
 *   4. Runs the rules engine over ALL ads and adsets of the brand (since
 *      KILLED and prior-state ads must still be considered).
 *   5. Persists `recommendations` rows and `csv_uploads` bookkeeping.
 *
 * This function operates on a database handle — pure data in, writes out.
 * Returns a summary for the UI.
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

export async function ingestMetaRows(args: IngestArgs): Promise<IngestResult> {
  const { db, brandId, accountId, sourceId, uploadedBy, filename, rows } = args;

  if (rows.length === 0) {
    throw new Error("No rows to ingest");
  }

  const dateRange = {
    start: rows.reduce((m, r) => (r.date < m ? r.date : m), rows[0]!.date),
    end: rows.reduce((m, r) => (r.date > m ? r.date : m), rows[0]!.date),
  };

  // --- 1. Verify the account belongs to the brand ---
  const [account] = await db
    .select()
    .from(adAccounts)
    .where(and(eq(adAccounts.id, accountId), eq(adAccounts.brandId, brandId)))
    .limit(1);
  if (!account) {
    throw new Error(`Account ${accountId} does not belong to brand ${brandId}`);
  }

  // --- 2. Upsert adsets ---
  const distinctAdsets = new Map<string, { name: string; campaign: string | null }>();
  for (const r of rows) {
    if (!distinctAdsets.has(r.adset_external_id)) {
      distinctAdsets.set(r.adset_external_id, {
        name: r.adset_name,
        campaign: r.campaign_name,
      });
    }
  }

  const adsetIdMap = new Map<string, string>(); // external_id → internal id
  let adsetsUpserted = 0;

  for (const [extId, info] of distinctAdsets) {
    const existing = await db
      .select()
      .from(adsets)
      .where(and(eq(adsets.accountId, accountId), eq(adsets.externalId, extId)))
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0]!;
      adsetIdMap.set(extId, row.id);
      // Optional: update name if changed.
      if (row.name !== info.name) {
        await db
          .update(adsets)
          .set({ name: info.name, campaignName: info.campaign, updatedAt: new Date() })
          .where(eq(adsets.id, row.id));
      }
    } else {
      const id = newId("adset");
      await db.insert(adsets).values({
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
      adsetsUpserted += 1;
    }
  }

  // --- 3. Upsert ads ---
  const distinctAds = new Map<string, { adsetExt: string; name: string }>();
  for (const r of rows) {
    const key = `${r.adset_external_id}::${r.ad_external_id}`;
    if (!distinctAds.has(key)) {
      distinctAds.set(key, { adsetExt: r.adset_external_id, name: r.ad_name });
    }
  }

  const adIdMap = new Map<string, string>();
  let adsUpserted = 0;
  for (const [key, info] of distinctAds) {
    const adsetInternalId = adsetIdMap.get(info.adsetExt)!;
    const extAdId = key.split("::")[1]!;
    const existing = await db
      .select()
      .from(ads)
      .where(and(eq(ads.adsetId, adsetInternalId), eq(ads.externalId, extAdId)))
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0]!;
      adIdMap.set(key, row.id);
      if (row.name !== info.name) {
        await db
          .update(ads)
          .set({ name: info.name, updatedAt: new Date() })
          .where(eq(ads.id, row.id));
      }
    } else {
      const id = newId("ad");
      await db.insert(ads).values({
        id,
        externalId: extAdId,
        adsetId: adsetInternalId,
        name: info.name,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      adIdMap.set(key, id);
      adsUpserted += 1;
    }
  }

  // --- 4. Insert ad_daily_stats ---
  // Upsert semantics: key is (ad, date, breakdown*).  SQLite ON CONFLICT.
  let statsInserted = 0;
  for (const r of rows) {
    const adKey = `${r.adset_external_id}::${r.ad_external_id}`;
    const adId = adIdMap.get(adKey)!;
    await db
      .insert(adDailyStats)
      .values({
        id: newId("stat"),
        adId,
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
      })
      .onConflictDoUpdate({
        target: [
          adDailyStats.adId,
          adDailyStats.date,
          adDailyStats.platform,
          adDailyStats.placement,
          adDailyStats.ageRange,
          adDailyStats.gender,
          adDailyStats.region,
          adDailyStats.device,
        ],
        set: {
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
        },
      });
    statsInserted += 1;
  }

  // --- 5. Recompute adset_daily_stats ---
  // Engagement rollups:
  //   ctr = SUM(clicks) / SUM(impressions) (pooled)
  //   cpm = SUM(spend) * 1000 / SUM(impressions)
  //   frequency = SUM(frequency * impressions) / SUM(impressions) (impression-weighted average)
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

  for (const a of aggRows) {
    const ctr = a.impressions > 0 ? a.clicks / a.impressions : null;
    const cpm = a.impressions > 0 ? (a.spendUsd * 1000) / a.impressions : null;
    const frequency =
      a.freqNum !== null && a.impressions > 0 ? a.freqNum / a.impressions : null;
    const roas = a.spendUsd > 0 ? a.revenueUsd / a.spendUsd : null;

    await db
      .insert(adsetDailyStats)
      .values({
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
        roas,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [adsetDailyStats.adsetId, adsetDailyStats.date],
        set: {
          spendUsd: a.spendUsd,
          revenueUsd: a.revenueUsd,
          purchases: a.purchases,
          impressions: a.impressions,
          clicks: a.clicks,
          ctr,
          cpm,
          frequency,
          roas,
        },
      });
  }

  // --- 6. Load brand economics + brand row → thresholds ---
  const [econ] = await db
    .select()
    .from(brandEconomics)
    .where(eq(brandEconomics.brandId, brandId))
    .orderBy(sql`${brandEconomics.version} DESC`)
    .limit(1);
  if (!econ) {
    throw new Error(`Brand ${brandId} has no economics configured`);
  }

  const [brandRow] = await db
    .select({ exchangeRate: brands.exchangeRate })
    .from(brands)
    .where(eq(brands.id, brandId))
    .limit(1);
  if (!brandRow) {
    throw new Error(`Brand ${brandId} not found`);
  }

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

  // --- 7. Run rules engine over ALL ads of the brand ---
  const allAdsOfBrand = await db
    .select({
      adId: ads.id,
      killedAt: ads.killedAt,
      spend: sql<number>`COALESCE(SUM(${adDailyStats.spendUsd}), 0)`.as("spend"),
      revenue: sql<number>`COALESCE(SUM(${adDailyStats.revenueUsd}), 0)`.as("rev"),
      purchases: sql<number>`COALESCE(SUM(${adDailyStats.purchases}), 0)`.as("p"),
      frequency: sql<number | null>`MAX(${adDailyStats.frequency})`.as("freq"),
      days: sql<number>`COUNT(DISTINCT ${adDailyStats.date})`.as("days"),
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
      days_with_roas_above_min: 0, // enriched below
    },
  }));

  // Enrich days_with_roas_above_min per ad
  for (const input of adInputs) {
    const daysRows = await db
      .select({ date: adDailyStats.date, roas: adDailyStats.roas })
      .from(adDailyStats)
      .where(eq(adDailyStats.adId, input.ad_id));
    input.perf.days_with_roas_above_min = daysRows.filter(
      (d) => d.roas !== null && d.roas >= thresholds.min_roas,
    ).length;
  }

  const allAdsetsOfBrand = await db
    .select({
      adsetId: adsets.id,
      spend: sql<number>`COALESCE(SUM(${adsetDailyStats.spendUsd}), 0)`.as("s"),
      revenue: sql<number>`COALESCE(SUM(${adsetDailyStats.revenueUsd}), 0)`.as("r"),
      purchases: sql<number>`COALESCE(SUM(${adsetDailyStats.purchases}), 0)`.as("p"),
      days: sql<number>`COUNT(DISTINCT ${adsetDailyStats.date})`.as("d"),
    })
    .from(adsets)
    .leftJoin(adsetDailyStats, eq(adsetDailyStats.adsetId, adsets.id))
    .where(eq(adsets.accountId, accountId))
    .groupBy(adsets.id);

  const adsetInputs: AdsetInput[] = [];
  for (const row of allAdsetsOfBrand) {
    const sustained = await db
      .select({ count: sql<number>`COUNT(*)`.as("c") })
      .from(adsetDailyStats)
      .where(
        and(
          eq(adsetDailyStats.adsetId, row.adsetId),
          sql`${adsetDailyStats.roas} >= ${thresholds.min_roas}`,
        ),
      );
    adsetInputs.push({
      adset_id: row.adsetId,
      perf: {
        total_spend_usd: row.spend,
        total_revenue_usd: row.revenue,
        total_purchases: row.purchases,
        days_with_data: row.days,
        days_with_roas_above_min: Number(sustained[0]?.count ?? 0),
        active_ads_count: 0, // informational only
      },
    });
  }

  const totalSpend = allAdsetsOfBrand.reduce((s, a) => s + a.spend, 0);
  const totalRev = allAdsetsOfBrand.reduce((s, a) => s + a.revenue, 0);
  const accountRoas = totalSpend > 0 ? totalRev / totalSpend : 0;

  const engineOutput = buildRecommendations({
    thresholds,
    ads: adInputs,
    adsets: adsetInputs,
    account_roas: accountRoas,
  });

  // --- 8. Persist recommendations + ad verdicts + upload record ---
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

  for (const rec of engineOutput.ads) {
    await db.insert(recommendations).values({
      id: newId("rec"),
      brandId,
      uploadId,
      entityType: "ad",
      entityId: rec.ad_id,
      action: rec.action,
      reason: rec.reason,
      metricsSnapshot: JSON.stringify(rec.metrics),
      executed: 0,
      createdAt: new Date(),
    });
    // Update ad's verdict cache
    await db
      .update(ads)
      .set({
        verdict: rec.verdict,
        verdictReason: rec.reason,
        killedAt:
          rec.verdict === "LOSER" || rec.verdict === "KILLED"
            ? new Date()
            : undefined,
        updatedAt: new Date(),
      })
      .where(eq(ads.id, rec.ad_id));
  }

  for (const rec of engineOutput.adsets) {
    await db.insert(recommendations).values({
      id: newId("rec"),
      brandId,
      uploadId,
      entityType: "adset",
      entityId: rec.adset_id,
      action: rec.action.toLowerCase(),
      reason: rec.reason,
      metricsSnapshot: JSON.stringify({
        ...rec.metrics,
        budget_change_pct: rec.budget_change_pct,
      }),
      executed: 0,
      createdAt: new Date(),
    });
  }

  return {
    uploadId,
    adsetsUpserted,
    adsUpserted,
    statsInserted,
    recommendations: {
      ads: engineOutput.ads.length,
      adsets: engineOutput.adsets.length,
    },
    thresholds,
    dateRange,
  };
}
