/**
 * Seed Feel Ink and Skinglow placeholder data.
 *
 * Run:  npm run db:seed
 *
 * Behavior:
 *   - Creates ad_sources (meta, tiktok) if missing.
 *   - Creates brands feel-ink and skinglow owned by SEED_OWNER_ID.
 *   - Inserts brand_economics rows with the Cronus-style inputs.
 *   - Does NOT create ads/adsets — those come from CSV uploads.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../src/lib/db/schema";
import { calculateBrandThresholds } from "../src/lib/rules-engine";
import { nanoid } from "nanoid";

const OWNER_ID = process.env.SEED_OWNER_ID ?? "user_seed_owner";

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("TURSO_DATABASE_URL is not set");
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  const db = drizzle(client, { schema });

  console.log("[seed] Seeding ad sources…");
  await ensureAdSource(db, "meta", "Meta Ads");
  await ensureAdSource(db, "tiktok", "TikTok Ads");

  console.log("[seed] Seeding brands…");
  await ensureBrand(db, {
    slug: "feel-ink",
    name: "Feel Ink",
    economics: {
      aov_mxn: 1157.31,
      cogs_per_order_mxn: 141,
      shipping_mxn: 125,
      shopify_fee_mxn: 11.57,
      payment_fee_mxn: 46.29,
      target_margin_pct: 0.22,
      min_roas: 2.0,
      pieces_per_order: 1,
      exchange_rate: 17.5,
    },
  });

  await ensureBrand(db, {
    slug: "skinglow",
    name: "Skinglow",
    economics: {
      aov_mxn: 890,
      cogs_per_order_mxn: 110,
      shipping_mxn: 120,
      shopify_fee_mxn: 8.9,
      payment_fee_mxn: 35.6,
      target_margin_pct: 0.25,
      min_roas: 2.0,
      pieces_per_order: 1,
      exchange_rate: 17.5,
    },
  });

  console.log("[seed] Done.");
  process.exit(0);
}

async function ensureAdSource(
  db: ReturnType<typeof drizzle<typeof schema>>,
  name: string,
  displayName: string,
) {
  const [existing] = await db
    .select()
    .from(schema.adSources)
    .where(eq(schema.adSources.name, name))
    .limit(1);
  if (existing) return existing.id;
  const id = `src_${nanoid(12)}`;
  await db.insert(schema.adSources).values({ id, name, displayName });
  return id;
}

async function ensureBrand(
  db: ReturnType<typeof drizzle<typeof schema>>,
  input: {
    slug: string;
    name: string;
    economics: Parameters<typeof calculateBrandThresholds>[0];
  },
) {
  const [existing] = await db
    .select()
    .from(schema.brands)
    .where(eq(schema.brands.slug, input.slug))
    .limit(1);
  if (existing) {
    console.log(`[seed]   ${input.slug} already exists, skipping.`);
    return existing.id;
  }
  const t = calculateBrandThresholds(input.economics);
  const brandId = `brand_${nanoid(12)}`;
  const now = new Date();
  await db.insert(schema.brands).values({
    id: brandId,
    name: input.name,
    slug: input.slug,
    currencyAccount: "USD",
    currencyBusiness: "MXN",
    exchangeRate: input.economics.exchange_rate,
    ownerId: OWNER_ID,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.brandEconomics).values({
    id: `econ_${nanoid(12)}`,
    brandId,
    aovMxn: input.economics.aov_mxn,
    cogsPerOrderMxn: input.economics.cogs_per_order_mxn,
    shippingMxn: input.economics.shipping_mxn,
    shopifyFeeMxn: input.economics.shopify_fee_mxn,
    paymentFeeMxn: input.economics.payment_fee_mxn,
    targetMarginPct: input.economics.target_margin_pct,
    minRoas: input.economics.min_roas,
    piecesPerOrder: input.economics.pieces_per_order,
    totalCostPerOrderMxn: t.total_cost_per_order_mxn,
    marginPerOrderMxn: t.margin_per_order_mxn,
    cacTargetUsd: t.cac_target_usd,
    cacBreakevenUsd: t.cac_breakeven_usd,
    testThresholdUsd: t.test_threshold_usd,
    aovUsd: t.aov_usd,
    version: 1,
    effectiveFrom: now,
    createdAt: now,
  });
  console.log(
    `[seed]   ${input.slug}: CAC target $${t.cac_target_usd.toFixed(2)}, test $${t.test_threshold_usd.toFixed(2)}`,
  );
  return brandId;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
