import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { brands, brandEconomics } from "@/lib/db/schema";
import { calculateBrandThresholds } from "@/lib/rules-engine";
import { newId } from "@/lib/utils/id";
import { logger } from "@/lib/utils/logger";

const createBrandSchema = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Slug debe ser kebab-case alfanumérico"),
  currencyAccount: z.string().default("USD"),
  currencyBusiness: z.string().default("MXN"),
  exchangeRate: z.number().positive(),
  economics: z.object({
    aov_mxn: z.number().positive(),
    cogs_per_order_mxn: z.number().nonnegative(),
    shipping_mxn: z.number().nonnegative(),
    shopify_fee_mxn: z.number().nonnegative(),
    payment_fee_mxn: z.number().nonnegative(),
    target_margin_pct: z.number().min(0).max(0.99),
    min_roas: z.number().positive(),
    pieces_per_order: z.number().int().positive(),
  }),
});

export async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const rows = await db
    .select()
    .from(brands)
    .where(eq(brands.ownerId, userId));
  return NextResponse.json({ brands: rows });
}

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createBrandSchema.parse(body);

    // Calculate thresholds (also validates economics)
    const thresholds = calculateBrandThresholds({
      ...parsed.economics,
      exchange_rate: parsed.exchangeRate,
    });

    const brandId = newId("brand");
    const now = new Date();

    await db.insert(brands).values({
      id: brandId,
      name: parsed.name,
      slug: parsed.slug,
      currencyAccount: parsed.currencyAccount,
      currencyBusiness: parsed.currencyBusiness,
      exchangeRate: parsed.exchangeRate,
      ownerId: userId,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(brandEconomics).values({
      id: newId("econ"),
      brandId,
      aovMxn: parsed.economics.aov_mxn,
      cogsPerOrderMxn: parsed.economics.cogs_per_order_mxn,
      shippingMxn: parsed.economics.shipping_mxn,
      shopifyFeeMxn: parsed.economics.shopify_fee_mxn,
      paymentFeeMxn: parsed.economics.payment_fee_mxn,
      targetMarginPct: parsed.economics.target_margin_pct,
      minRoas: parsed.economics.min_roas,
      piecesPerOrder: parsed.economics.pieces_per_order,
      totalCostPerOrderMxn: thresholds.total_cost_per_order_mxn,
      marginPerOrderMxn: thresholds.margin_per_order_mxn,
      cacTargetUsd: thresholds.cac_target_usd,
      cacBreakevenUsd: thresholds.cac_breakeven_usd,
      testThresholdUsd: thresholds.test_threshold_usd,
      aovUsd: thresholds.aov_usd,
      version: 1,
      effectiveFrom: now,
      createdAt: now,
    });

    logger.info({ brandId, slug: parsed.slug }, "Brand created");
    return NextResponse.json({ brandId, thresholds }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "validation_error", issues: e.issues },
        { status: 400 },
      );
    }
    logger.error({ err: e }, "Failed to create brand");
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
