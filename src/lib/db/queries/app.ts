/**
 * App-level aggregated queries (across all brands of the current user).
 */

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  brands,
  ads,
  adsets,
  adAccounts,
  adDailyStats,
  recommendations,
  csvUploads,
} from "@/lib/db/schema";

export async function getUserBrands(ownerId: string) {
  return db
    .select({ id: brands.id, slug: brands.slug, name: brands.name })
    .from(brands)
    .where(eq(brands.ownerId, ownerId));
}

export async function getGlobalSummary(ownerId: string) {
  const userBrands = await getUserBrands(ownerId);
  const brandIds = userBrands.map((b) => b.id);
  if (brandIds.length === 0) {
    return {
      brands: [],
      totals: { spend: 0, revenue: 0, purchases: 0, roas: 0, adsCount: 0, adsetsCount: 0 },
    };
  }

  // Totals across all brands owned by user
  const totals = await db
    .select({
      spend: sql<number>`COALESCE(SUM(${adDailyStats.spendUsd}), 0)`.as("s"),
      revenue: sql<number>`COALESCE(SUM(${adDailyStats.revenueUsd}), 0)`.as("r"),
      purchases: sql<number>`COALESCE(SUM(${adDailyStats.purchases}), 0)`.as("p"),
    })
    .from(adDailyStats)
    .innerJoin(ads, eq(ads.id, adDailyStats.adId))
    .innerJoin(adsets, eq(adsets.id, ads.adsetId))
    .innerJoin(adAccounts, eq(adAccounts.id, adsets.accountId))
    .where(inArray(adAccounts.brandId, brandIds));

  const adCounts = await db
    .select({
      adsCount: sql<number>`COUNT(DISTINCT ${ads.id})`.as("ac"),
      adsetsCount: sql<number>`COUNT(DISTINCT ${adsets.id})`.as("sc"),
    })
    .from(ads)
    .innerJoin(adsets, eq(adsets.id, ads.adsetId))
    .innerJoin(adAccounts, eq(adAccounts.id, adsets.accountId))
    .where(inArray(adAccounts.brandId, brandIds));

  const t = totals[0] ?? { spend: 0, revenue: 0, purchases: 0 };
  const c = adCounts[0] ?? { adsCount: 0, adsetsCount: 0 };

  // Per-brand summary
  const perBrand = await db
    .select({
      brandId: adAccounts.brandId,
      spend: sql<number>`COALESCE(SUM(${adDailyStats.spendUsd}), 0)`.as("s"),
      revenue: sql<number>`COALESCE(SUM(${adDailyStats.revenueUsd}), 0)`.as("r"),
      purchases: sql<number>`COALESCE(SUM(${adDailyStats.purchases}), 0)`.as("p"),
    })
    .from(adDailyStats)
    .innerJoin(ads, eq(ads.id, adDailyStats.adId))
    .innerJoin(adsets, eq(adsets.id, ads.adsetId))
    .innerJoin(adAccounts, eq(adAccounts.id, adsets.accountId))
    .where(inArray(adAccounts.brandId, brandIds))
    .groupBy(adAccounts.brandId);

  const perBrandMap = new Map(perBrand.map((r) => [r.brandId, r]));

  return {
    brands: userBrands.map((b) => {
      const m = perBrandMap.get(b.id) ?? { spend: 0, revenue: 0, purchases: 0 };
      return {
        ...b,
        spend_usd: m.spend,
        revenue_usd: m.revenue,
        purchases: m.purchases,
        roas: m.spend > 0 ? m.revenue / m.spend : 0,
      };
    }),
    totals: {
      spend: t.spend,
      revenue: t.revenue,
      purchases: t.purchases,
      roas: t.spend > 0 ? t.revenue / t.spend : 0,
      adsCount: Number(c.adsCount),
      adsetsCount: Number(c.adsetsCount),
    },
  };
}

export async function getPendingRecommendations(ownerId: string, limit = 12) {
  const userBrands = await getUserBrands(ownerId);
  const brandIds = userBrands.map((b) => b.id);
  if (brandIds.length === 0) return [];

  return db
    .select({
      id: recommendations.id,
      brandId: recommendations.brandId,
      entityType: recommendations.entityType,
      entityId: recommendations.entityId,
      action: recommendations.action,
      reason: recommendations.reason,
      createdAt: recommendations.createdAt,
    })
    .from(recommendations)
    .where(
      and(
        inArray(recommendations.brandId, brandIds),
        eq(recommendations.executed, 0),
      ),
    )
    .orderBy(desc(recommendations.createdAt))
    .limit(limit);
}

export async function getRecentUploads(ownerId: string, limit = 5) {
  const userBrands = await getUserBrands(ownerId);
  const brandIds = userBrands.map((b) => b.id);
  if (brandIds.length === 0) return [];
  return db
    .select()
    .from(csvUploads)
    .where(inArray(csvUploads.brandId, brandIds))
    .orderBy(desc(csvUploads.createdAt))
    .limit(limit);
}

export async function getTopAds(ownerId: string, opts: { limit?: number; order?: "winner" | "loser" } = {}) {
  const userBrands = await getUserBrands(ownerId);
  const brandIds = userBrands.map((b) => b.id);
  if (brandIds.length === 0) return [];

  const rows = await db
    .select({
      adId: ads.id,
      adName: ads.name,
      adsetName: adsets.name,
      brandId: adAccounts.brandId,
      verdict: ads.verdict,
      spend: sql<number>`COALESCE(SUM(${adDailyStats.spendUsd}), 0)`.as("s"),
      revenue: sql<number>`COALESCE(SUM(${adDailyStats.revenueUsd}), 0)`.as("r"),
      purchases: sql<number>`COALESCE(SUM(${adDailyStats.purchases}), 0)`.as("p"),
    })
    .from(ads)
    .innerJoin(adsets, eq(adsets.id, ads.adsetId))
    .innerJoin(adAccounts, eq(adAccounts.id, adsets.accountId))
    .leftJoin(adDailyStats, eq(adDailyStats.adId, ads.id))
    .where(inArray(adAccounts.brandId, brandIds))
    .groupBy(ads.id, ads.name, adsets.name, adAccounts.brandId, ads.verdict);

  const enriched = rows.map((r) => ({
    ...r,
    roas: r.spend > 0 ? r.revenue / r.spend : 0,
  }));

  const order = opts.order ?? "winner";
  const limit = opts.limit ?? 5;
  if (order === "winner") {
    return enriched
      .filter((r) => r.spend > 0)
      .sort((a, b) => b.roas - a.roas)
      .slice(0, limit);
  }
  return enriched
    .filter((r) => r.spend > 20)
    .sort((a, b) => a.roas - b.roas)
    .slice(0, limit);
}
