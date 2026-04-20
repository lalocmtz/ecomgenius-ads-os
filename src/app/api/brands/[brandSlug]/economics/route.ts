import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { brands, brandEconomics } from "@/lib/db/schema";
import { calculateBrandThresholds } from "@/lib/rules-engine";
import { newId } from "@/lib/utils/id";
import { logger } from "@/lib/utils/logger";

const patchSchema = z.object({
  aov_mxn: z.number().positive(),
  cogs_per_order_mxn: z.number().nonnegative(),
  shipping_mxn: z.number().nonnegative(),
  shopify_fee_mxn: z.number().nonnegative(),
  payment_fee_mxn: z.number().nonnegative(),
  target_margin_pct: z.number().min(0).max(0.99),
  min_roas: z.number().positive(),
  pieces_per_order: z.number().int().positive(),
  exchange_rate: z.number().positive().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { brandSlug: string } },
) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const [brand] = await db
    .select()
    .from(brands)
    .where(and(eq(brands.slug, params.brandSlug), eq(brands.ownerId, userId)))
    .limit(1);
  if (!brand) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = patchSchema.parse(body);

    const exchangeRate = parsed.exchange_rate ?? brand.exchangeRate;
    const thresholds = calculateBrandThresholds({
      aov_mxn: parsed.aov_mxn,
      cogs_per_order_mxn: parsed.cogs_per_order_mxn,
      shipping_mxn: parsed.shipping_mxn,
      shopify_fee_mxn: parsed.shopify_fee_mxn,
      payment_fee_mxn: parsed.payment_fee_mxn,
      target_margin_pct: parsed.target_margin_pct,
      min_roas: parsed.min_roas,
      pieces_per_order: parsed.pieces_per_order,
      exchange_rate: exchangeRate,
    });

    const [latest] = await db
      .select({ version: brandEconomics.version })
      .from(brandEconomics)
      .where(eq(brandEconomics.brandId, brand.id))
      .orderBy(desc(brandEconomics.version))
      .limit(1);
    const nextVersion = (latest?.version ?? 0) + 1;
    const now = new Date();

    await db.insert(brandEconomics).values({
      id: newId("econ"),
      brandId: brand.id,
      aovMxn: parsed.aov_mxn,
      cogsPerOrderMxn: parsed.cogs_per_order_mxn,
      shippingMxn: parsed.shipping_mxn,
      shopifyFeeMxn: parsed.shopify_fee_mxn,
      paymentFeeMxn: parsed.payment_fee_mxn,
      targetMarginPct: parsed.target_margin_pct,
      minRoas: parsed.min_roas,
      piecesPerOrder: parsed.pieces_per_order,
      totalCostPerOrderMxn: thresholds.total_cost_per_order_mxn,
      marginPerOrderMxn: thresholds.margin_per_order_mxn,
      cacTargetUsd: thresholds.cac_target_usd,
      cacBreakevenUsd: thresholds.cac_breakeven_usd,
      testThresholdUsd: thresholds.test_threshold_usd,
      aovUsd: thresholds.aov_usd,
      version: nextVersion,
      effectiveFrom: now,
      createdAt: now,
    });

    if (parsed.exchange_rate && parsed.exchange_rate !== brand.exchangeRate) {
      await db
        .update(brands)
        .set({ exchangeRate: parsed.exchange_rate, updatedAt: now })
        .where(eq(brands.id, brand.id));
    }

    logger.info({ brandId: brand.id, version: nextVersion }, "Economics updated");
    return NextResponse.json({ version: nextVersion, thresholds });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "validation_error", issues: e.issues },
        { status: 400 },
      );
    }
    logger.error({ err: e }, "Failed to patch economics");
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
