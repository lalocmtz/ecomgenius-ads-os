import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getBrandBySlug, getBrandEconomics } from "@/lib/db/queries/brands";
import {
  getAdsetsForBrand,
  getBrandDateBounds,
} from "@/lib/db/queries/dashboard";
import { ConfigClient, type AdsetPreviewRow } from "./ConfigClient";

export default async function BrandConfigPage({
  params,
}: {
  params: { brandSlug: string };
}) {
  const { userId } = auth();
  if (!userId) notFound();

  const brand = await getBrandBySlug(params.brandSlug, userId);
  if (!brand) notFound();
  const econ = await getBrandEconomics(brand.id);

  const initial = {
    aov_mxn: econ?.aovMxn ?? 1000,
    cogs_per_order_mxn: econ?.cogsPerOrderMxn ?? 300,
    shipping_mxn: econ?.shippingMxn ?? 150,
    shopify_fee_mxn: econ?.shopifyFeeMxn ?? 30,
    payment_fee_mxn: econ?.paymentFeeMxn ?? 40,
    target_margin_pct: econ?.targetMarginPct ?? 0.3,
    min_roas: econ?.minRoas ?? 2,
    pieces_per_order: econ?.piecesPerOrder ?? 1,
    exchange_rate: brand.exchangeRate,
  };

  const bounds = await getBrandDateBounds(brand.id);
  let adsetsForPreview: AdsetPreviewRow[] = [];
  if (bounds.min && bounds.max) {
    const rows = await getAdsetsForBrand(
      brand.id,
      { start: bounds.min, end: bounds.max },
      initial.min_roas,
    );
    adsetsForPreview = rows
      .filter((r) => r.spendUsd > 0)
      .map((r) => ({ spendUsd: r.spendUsd, revenueUsd: r.revenueUsd }));
  }

  return (
    <ConfigClient
      brandSlug={brand.slug}
      brandName={brand.name}
      version={econ?.version ?? 0}
      initial={initial}
      adsetsForPreview={adsetsForPreview}
    />
  );
}
