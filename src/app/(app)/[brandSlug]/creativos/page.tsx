import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Palette } from "lucide-react";
import { RangeFilter } from "@/components/ads/RangeFilter";
import {
  getBrandBySlug,
  getBrandEconomics,
} from "@/lib/db/queries/brands";
import {
  getAdsetsForBrand,
  getAdsForBrand,
  getBrandDateBounds,
} from "@/lib/db/queries/dashboard";
import { calculateBrandThresholds } from "@/lib/rules-engine";
import {
  parseRange,
  resolveRange,
  RANGE_LABELS,
} from "@/lib/utils/date-range";
import type { AdVerdict } from "@/lib/rules-engine/types";
import { CreativosClient, type CreativoRow } from "./CreativosClient";

export default async function CreativosPage({
  params,
  searchParams,
}: {
  params: { brandSlug: string };
  searchParams: { range?: string };
}) {
  const { userId } = auth();
  if (!userId) notFound();

  const brand = await getBrandBySlug(params.brandSlug, userId);
  if (!brand) notFound();

  const rangeKey = parseRange(searchParams.range);
  const bounds = await getBrandDateBounds(brand.id);

  if (!bounds.max) {
    return (
      <div className="space-y-6">
        <header className="flex items-center gap-3">
          <Palette className="h-7 w-7 text-verdict-inconcluso" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Creativos — {brand.name}
            </h1>
            <p className="mt-1 text-text-secondary">
              Sin datos todavía. Sube un CSV para ver los anuncios.
            </p>
          </div>
        </header>
        <div className="rounded-lg border border-dashed border-border bg-bg-raised p-8 text-center">
          <Link
            href={`/${brand.slug}/upload`}
            className="inline-block rounded-md bg-verdict-winner px-4 py-2 font-medium text-bg"
          >
            Subir CSV
          </Link>
        </div>
      </div>
    );
  }

  const range = resolveRange(rangeKey, bounds);
  const econ = await getBrandEconomics(brand.id);
  const thresholds = econ
    ? calculateBrandThresholds({
        aov_mxn: econ.aovMxn,
        cogs_per_order_mxn: econ.cogsPerOrderMxn,
        shipping_mxn: econ.shippingMxn,
        shopify_fee_mxn: econ.shopifyFeeMxn,
        payment_fee_mxn: econ.paymentFeeMxn,
        target_margin_pct: econ.targetMarginPct,
        min_roas: econ.minRoas,
        pieces_per_order: econ.piecesPerOrder,
        exchange_rate: brand.exchangeRate,
      })
    : null;
  const minRoas = thresholds?.min_roas ?? 2;

  const [adsetRows, adRows] = await Promise.all([
    getAdsetsForBrand(brand.id, range, minRoas),
    getAdsForBrand(brand.id, range),
  ]);

  const adsetById = new Map(adsetRows.map((a) => [a.adsetId, a]));

  const rows: CreativoRow[] = adRows.map((ad) => {
    const adset = adsetById.get(ad.adsetId);
    return {
      adId: ad.adId,
      adName: ad.adName,
      adsetName: adset?.adsetName ?? "—",
      campaignName: adset?.campaignName ?? null,
      verdict: (ad.verdict as AdVerdict | null) ?? null,
      spendUsd: ad.spendUsd,
      revenueUsd: ad.revenueUsd,
      purchases: ad.purchases,
      impressions: ad.impressions,
      roas: ad.roas,
      hookRatePct: ad.hookRatePct,
      frequency: ad.frequency,
    };
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div className="flex items-center gap-3">
          <Palette className="h-7 w-7 text-verdict-inconcluso" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Creativos — {brand.name}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              {RANGE_LABELS[rangeKey]} · {range.start}
              {range.start !== range.end ? ` → ${range.end}` : ""}
            </p>
          </div>
        </div>
        <RangeFilter active={rangeKey} />
      </header>

      <CreativosClient
        brandSlug={brand.slug}
        rows={rows}
        minRoas={minRoas}
      />
    </div>
  );
}
