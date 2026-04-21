import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  brands,
  adAccounts,
  adsets,
  ads,
  adDailyStats,
  adsetDailyStats,
  csvUploads,
  recommendations,
} from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * DELETE /api/brands/[brandSlug]/reset
 *
 * Wipes all ad/adset/stats/history for the brand while keeping the brand
 * record, economics, and ad-account shell (which is recreated on next upload).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { brandSlug: string } },
) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const [brand] = await db
    .select()
    .from(brands)
    .where(and(eq(brands.slug, params.brandSlug), eq(brands.ownerId, userId)))
    .limit(1);

  if (!brand) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  // Collect ad account IDs for this brand
  const accountRows = await db
    .select({ id: adAccounts.id })
    .from(adAccounts)
    .where(eq(adAccounts.brandId, brand.id));
  const accountIds = accountRows.map((r) => r.id);

  // Collect adset IDs
  const adsetRows =
    accountIds.length > 0
      ? await db
          .select({ id: adsets.id })
          .from(adsets)
          .where(inArray(adsets.accountId, accountIds))
      : [];
  const adsetIds = adsetRows.map((r) => r.id);

  // Collect ad IDs
  const adRows =
    adsetIds.length > 0
      ? await db.select({ id: ads.id }).from(ads).where(inArray(ads.adsetId, adsetIds))
      : [];
  const adIds = adRows.map((r) => r.id);

  // Delete in dependency order
  if (adIds.length > 0) {
    await db.delete(adDailyStats).where(inArray(adDailyStats.adId, adIds));
  }
  if (adsetIds.length > 0) {
    await db.delete(adsetDailyStats).where(inArray(adsetDailyStats.adsetId, adsetIds));
    await db.delete(ads).where(inArray(ads.adsetId, adsetIds));
    await db.delete(adsets).where(inArray(adsets.id, adsetIds));
  }

  // Recommendations and uploads (brand-scoped, no FK dependency on adsets/ads)
  await db.delete(recommendations).where(eq(recommendations.brandId, brand.id));
  await db.delete(csvUploads).where(eq(csvUploads.brandId, brand.id));

  return NextResponse.json({ ok: true, brand: brand.slug });
}
