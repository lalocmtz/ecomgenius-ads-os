import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { StatCard } from "@/components/ui/StatCard";
import { RecommendationCard } from "@/components/ads/RecommendationCard";
import {
  getBrandBySlug,
  getAccountSummary,
  getLatestUpload,
  getRecommendationsForUpload,
  getAdsByIds,
  getAdsetsByIds,
  getBrandEconomics,
} from "@/lib/db/queries/brands";
import { calculateBrandThresholds } from "@/lib/rules-engine";
import { formatUsd, formatRoas, formatInt } from "@/lib/utils/format";

export default async function BrandDashboard({
  params,
}: {
  params: { brandSlug: string };
}) {
  const { userId } = auth();
  if (!userId) notFound();

  const brand = await getBrandBySlug(params.brandSlug, userId);
  if (!brand) notFound();

  const [summary, upload, econ] = await Promise.all([
    getAccountSummary(brand.id),
    getLatestUpload(brand.id),
    getBrandEconomics(brand.id),
  ]);

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

  const recs = upload ? await getRecommendationsForUpload(brand.id, upload.id) : [];
  const adRecs = recs.filter((r) => r.entityType === "ad");
  const adsetRecs = recs.filter((r) => r.entityType === "adset");
  const adById = new Map((await getAdsByIds(adRecs.map((r) => r.entityId))).map((a) => [a.id, a]));
  const adsetById = new Map(
    (await getAdsetsByIds(adsetRecs.map((r) => r.entityId))).map((a) => [a.id, a]),
  );

  // Group ad recs by action type
  const groups: Record<string, typeof adRecs> = {
    kill: [],
    rotate: [],
    iterate: [],
    let_run: [],
    keep: [],
  };
  for (const r of adRecs) {
    (groups[r.action] ?? (groups[r.action] = [])).push(r);
  }

  const accountUnderMin =
    thresholds && summary.roas > 0 && summary.roas < thresholds.min_roas;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-bold">{brand.name}</h1>
          <p className="text-text-secondary">
            Período:{" "}
            {upload
              ? `${upload.dateRangeStart} → ${upload.dateRangeEnd}`
              : "sin subidas aún"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/upload"
            className="rounded border border-border px-3 py-1.5 text-sm hover:bg-bg-hover"
          >
            Subir CSV
          </Link>
          <Link
            href={`/${brand.slug}/config`}
            className="rounded border border-border px-3 py-1.5 text-sm hover:bg-bg-hover"
          >
            Config
          </Link>
        </div>
      </header>

      {accountUnderMin && (
        <div className="mb-6 rounded-lg border border-verdict-loser/40 bg-verdict-loser/10 p-4">
          <p className="font-semibold text-verdict-loser">
            ⚠️ ROAS cuenta {formatRoas(summary.roas)} bajo mínimo (
            {formatRoas(thresholds.min_roas)}). Freno a escalamientos.
          </p>
        </div>
      )}

      <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Gasto" value={formatUsd(summary.spend_usd)} />
        <StatCard label="Revenue" value={formatUsd(summary.revenue_usd)} />
        <StatCard label="Compras" value={formatInt(summary.purchases)} />
        <StatCard label="ROAS" value={formatRoas(summary.roas)} />
      </section>

      {upload ? (
        <>
          <h2 className="mb-3 text-xl font-semibold">Acciones sugeridas</h2>
          <div className="space-y-6">
            {(["kill", "rotate", "iterate", "let_run", "keep"] as const).map((action) => {
              const list = groups[action] ?? [];
              if (list.length === 0) return null;
              return (
                <div key={action}>
                  <h3 className="mb-2 font-mono text-xs uppercase tracking-wider text-text-muted">
                    {action.replace("_", " ")} ({list.length})
                  </h3>
                  <div className="grid gap-2 md:grid-cols-2">
                    {list.map((r) => {
                      const ad = adById.get(r.entityId);
                      return (
                        <RecommendationCard
                          key={r.id}
                          brandSlug={brand.slug}
                          entityType="ad"
                          entityId={r.entityId}
                          entityName={ad?.name ?? r.entityId}
                          action={r.action}
                          reason={r.reason}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {adsetRecs.length > 0 && (
              <div>
                <h3 className="mb-2 font-mono text-xs uppercase tracking-wider text-text-muted">
                  Conjuntos ({adsetRecs.length})
                </h3>
                <div className="grid gap-2 md:grid-cols-2">
                  {adsetRecs.map((r) => {
                    const adset = adsetById.get(r.entityId);
                    return (
                      <RecommendationCard
                        key={r.id}
                        brandSlug={brand.slug}
                        entityType="adset"
                        entityId={r.entityId}
                        entityName={adset?.name ?? r.entityId}
                        action={r.action}
                        reason={r.reason}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-border bg-bg-raised p-8 text-center">
          <p className="text-text-secondary">
            Aún no hay datos. Sube el primer CSV para ver recomendaciones.
          </p>
          <Link
            href="/upload"
            className="mt-4 inline-block rounded bg-verdict-winner px-4 py-2 font-medium text-bg"
          >
            Subir CSV ahora
          </Link>
        </div>
      )}
    </main>
  );
}
