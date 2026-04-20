/**
 * Brand queries — reads scoped to the current user's ownership.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  brands,
  brandEconomics,
  ads,
  adsets,
  adAccounts,
  adDailyStats,
  recommendations,
  csvUploads,
} from "@/lib/db/schema";

export async function getBrandBySlug(slug: string, ownerId: string) {
  const [row] = await db
    .select()
    .from(brands)
    .where(and(eq(brands.slug, slug), eq(brands.ownerId, ownerId)))
    .limit(1);
  return row ?? null;
}

export async function getBrandEconomics(brandId: string) {
  const [row] = await db
    .select()
    .from(brandEconomics)
    .where(eq(brandEconomics.brandId, brandId))
    .orderBy(desc(brandEconomics.version))
    .limit(1);
  return row ?? null;
}

export async function getAccountSummary(brandId: string) {
  const result = await db
    .select({
      spend: sql<number>`COALESCE(SUM(${adDailyStats.spendUsd}), 0)`.as("s"),
      revenue: sql<number>`COALESCE(SUM(${adDailyStats.revenueUsd}), 0)`.as("r"),
      purchases: sql<number>`COALESCE(SUM(${adDailyStats.purchases}), 0)`.as("p"),
    })
    .from(adDailyStats)
    .innerJoin(ads, eq(ads.id, adDailyStats.adId))
    .innerJoin(adsets, eq(adsets.id, ads.adsetId))
    .innerJoin(adAccounts, eq(adAccounts.id, adsets.accountId))
    .where(eq(adAccounts.brandId, brandId));

  const row = result[0] ?? { spend: 0, revenue: 0, purchases: 0 };
  return {
    spend_usd: row.spend,
    revenue_usd: row.revenue,
    purchases: row.purchases,
    roas: row.spend > 0 ? row.revenue / row.spend : 0,
  };
}

export async function getLatestUpload(brandId: string) {
  const [row] = await db
    .select()
    .from(csvUploads)
    .where(eq(csvUploads.brandId, brandId))
    .orderBy(desc(csvUploads.createdAt))
    .limit(1);
  return row ?? null;
}

export async function getBrandUploads(brandId: string, limit = 50) {
  return db
    .select()
    .from(csvUploads)
    .where(eq(csvUploads.brandId, brandId))
    .orderBy(desc(csvUploads.createdAt))
    .limit(limit);
}

export async function getRecommendationsForUpload(brandId: string, uploadId: string) {
  return db
    .select()
    .from(recommendations)
    .where(
      and(
        eq(recommendations.brandId, brandId),
        eq(recommendations.uploadId, uploadId),
      ),
    );
}

export async function getAdsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(ads)
    .where(sql`${ads.id} IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);
  return rows;
}

export async function getAdsetsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(adsets)
    .where(sql`${adsets.id} IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);
  return rows;
}
