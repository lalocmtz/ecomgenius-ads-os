import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { StatCard } from "@/components/ui/StatCard";
import { AdsetCard } from "@/components/ads/AdsetCard";
import { RangeFilter } from "@/components/ads/RangeFilter";
import { CurrencyToggle, type DisplayCurrency } from "@/components/ads/CurrencyToggle";
import {
  getBrandBySlug,
  getBrandEconomics,
} from "@/lib/db/queries/brands";
import {
  getAdsetsForBrand,
  getAdsForBrand,
  getBrandRollup,
  getBrandDateBounds,
} from "@/lib/db/queries/dashboard";
import { calculateBrandThresholds } from "@/lib/rules-engine";
import { classifyAdset } from "@/lib/rules-engine/adset-classifier";
import { parseRange, resolveRange, RANGE_LABELS } from "@/lib/utils/date-range";
import { formatInt, formatMoney, formatRoas } from "@/lib/utils/format";

export default async function BrandDashboard({
  params,
  searchParams,
}: {
  params: { brandSlug: string };
  searchParams: { range?: string; currency?: string };
}) {
  const { userId } = auth();
  if (!userId) notFound();

  const brand = await getBrandBySlug(params.brandSlug, userId);
  if (!brand) notFound();

  const rangeKey = parseRange(searchParams.range);
  const currency: DisplayCurrency =
    searchParams.currency?.toUpperCase() === "MXN" ? "MXN" : "USD";
  const exchangeRate = brand.exchangeRate;
  const fmt = (usd: number) => formatMoney(usd, currency, exchangeRate);
  const bounds = await getBrandDateBounds(brand.id);

  if (!bounds.max) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-baseline justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{brand.name}</h1>
            <p className="mt-1 text-text-secondary">
              Aún no hay datos. Sube el primer CSV para ver recomendaciones.
            </p>
          </div>
        </header>
        <div className="rounded-lg border border-border bg-bg-raised p-8 text-center">
          <Link
            href={`/${brand.slug}/upload`}
            className="inline-block rounded-md bg-verdict-winner px-4 py-2 font-medium text-bg"
          >
            Subir CSV ahora
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

  const [rollup, adsetRows, adRows] = await Promise.all([
    getBrandRollup(brand.id, range),
    getAdsetsForBrand(brand.id, range, minRoas),
    getAdsForBrand(brand.id, range),
  ]);

  const adsByAdset = new Map<string, typeof adRows>();
  for (const ad of adRows) {
    if (ad.spendUsd === 0 && ad.impressions === 0) continue;
    const list = adsByAdset.get(ad.adsetId) ?? [];
    list.push(ad);
    adsByAdset.set(ad.adsetId, list);
  }
  for (const list of adsByAdset.values()) {
    list.sort((a, b) => b.spendUsd - a.spendUsd);
  }

  const visibleAdsets = adsetRows.filter((a) => a.spendUsd > 0);
  const accountRoas = rollup.roas;
  const accountUnderMin = thresholds && accountRoas > 0 && accountRoas < minRoas;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{brand.name}</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {RANGE_LABELS[rangeKey]} · {range.start}
            {range.start !== range.end ? ` → ${range.end}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangeFilter active={rangeKey} />
          <CurrencyToggle active={currency} />
          <Link
            href={`/${brand.slug}/upload`}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg-hover"
          >
            Subir CSV
          </Link>
          <Link
            href={`/${brand.slug}/config`}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg-hover"
          >
            Config
          </Link>
        </div>
      </header>

      {accountUnderMin && (
        <div className="rounded-lg border border-verdict-loser/40 bg-verdict-loser/10 p-4">
          <p className="font-semibold text-verdict-loser">
            ⚠️ ROAS cuenta {formatRoas(accountRoas)} bajo mínimo (
            {formatRoas(minRoas)}). Freno a escalamientos.
          </p>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label={`Gasto (${currency})`} value={fmt(rollup.spendUsd)} />
        <StatCard label={`Revenue (${currency})`} value={fmt(rollup.revenueUsd)} />
        <StatCard label="Compras" value={formatInt(rollup.purchases)} />
        <StatCard label="ROAS" value={formatRoas(rollup.roas)} />
        <StatCard
          label="Mínimo"
          value={thresholds ? formatRoas(thresholds.min_roas) : "—"}
        />
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">
          Conjuntos ({visibleAdsets.length})
        </h2>
        {visibleAdsets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-bg-raised p-8 text-center text-sm text-text-secondary">
            Sin gasto registrado en el período seleccionado.
          </div>
        ) : (
          <div className="space-y-2">
            {visibleAdsets.map((adset) => {
              const classification = thresholds
                ? classifyAdset(
                    {
                      total_spend_usd: adset.spendUsd,
                      total_revenue_usd: adset.revenueUsd,
                      total_purchases: adset.purchases,
                      days_with_data: adset.daysWithData,
                      days_with_roas_above_min: adset.daysWithRoasAboveMin,
                      active_ads_count: adsByAdset.get(adset.adsetId)?.length ?? 0,
                    },
                    thresholds,
                    accountRoas,
                  )
                : null;
              return (
                <AdsetCard
                  key={adset.adsetId}
                  brandSlug={brand.slug}
                  adset={adset}
                  action={classification?.action ?? null}
                  actionReason={classification?.reason ?? null}
                  ads={adsByAdset.get(adset.adsetId) ?? []}
                  minRoas={minRoas}
                  currency={currency}
                  exchangeRate={exchangeRate}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
