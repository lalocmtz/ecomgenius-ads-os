import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  ads,
  adsets,
  adAccounts,
  brands,
  adDailyStats,
  creativeAnalyses,
} from "@/lib/db/schema";
import { VerdictBadge } from "@/components/ui/VerdictBadge";
import { StatCard } from "@/components/ui/StatCard";
import { formatUsd, formatRoas, formatInt, formatPct } from "@/lib/utils/format";
import type { AdVerdict } from "@/lib/rules-engine/types";

export default async function AdDetailPage({
  params,
}: {
  params: { brandSlug: string; adId: string };
}) {
  const { userId } = auth();
  if (!userId) notFound();

  const [adRow] = await db
    .select({
      id: ads.id,
      name: ads.name,
      externalId: ads.externalId,
      status: ads.status,
      verdict: ads.verdict,
      verdictReason: ads.verdictReason,
      creativeAnalysisId: ads.creativeAnalysisId,
      adsetId: ads.adsetId,
      adsetName: adsets.name,
      brandSlug: brands.slug,
      brandOwner: brands.ownerId,
    })
    .from(ads)
    .innerJoin(adsets, eq(adsets.id, ads.adsetId))
    .innerJoin(adAccounts, eq(adAccounts.id, adsets.accountId))
    .innerJoin(brands, eq(brands.id, adAccounts.brandId))
    .where(and(eq(ads.id, params.adId), eq(brands.slug, params.brandSlug)))
    .limit(1);

  if (!adRow || adRow.brandOwner !== userId) notFound();

  const agg = await db
    .select({
      spend: sql<number>`COALESCE(SUM(${adDailyStats.spendUsd}), 0)`.as("s"),
      revenue: sql<number>`COALESCE(SUM(${adDailyStats.revenueUsd}), 0)`.as("r"),
      purchases: sql<number>`COALESCE(SUM(${adDailyStats.purchases}), 0)`.as("p"),
      impressions: sql<number>`COALESCE(SUM(${adDailyStats.impressions}), 0)`.as("i"),
      clicks: sql<number>`COALESCE(SUM(${adDailyStats.clicks}), 0)`.as("c"),
      frequency: sql<number | null>`MAX(${adDailyStats.frequency})`.as("f"),
    })
    .from(adDailyStats)
    .where(eq(adDailyStats.adId, adRow.id));

  const m = agg[0]!;
  const roas = m.spend > 0 ? m.revenue / m.spend : 0;
  const ctr = m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0;

  const timeseries = await db
    .select({
      date: adDailyStats.date,
      spend: sql<number>`SUM(${adDailyStats.spendUsd})`.as("s"),
      revenue: sql<number>`SUM(${adDailyStats.revenueUsd})`.as("r"),
      purchases: sql<number>`SUM(${adDailyStats.purchases})`.as("p"),
    })
    .from(adDailyStats)
    .where(eq(adDailyStats.adId, adRow.id))
    .groupBy(adDailyStats.date)
    .orderBy(adDailyStats.date);

  const analysis = adRow.creativeAnalysisId
    ? (
        await db
          .select()
          .from(creativeAnalyses)
          .where(eq(creativeAnalyses.id, adRow.creativeAnalysisId))
          .orderBy(desc(creativeAnalyses.createdAt))
          .limit(1)
      )[0] ?? null
    : null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link
        href={`/${adRow.brandSlug}`}
        className="mb-4 inline-block text-sm text-text-secondary hover:text-text-primary"
      >
        ← Dashboard
      </Link>

      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{adRow.name}</h1>
            {adRow.verdict && <VerdictBadge verdict={adRow.verdict as AdVerdict} />}
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            Conjunto:{" "}
            <Link
              href={`/${adRow.brandSlug}/adsets/${adRow.adsetId}`}
              className="underline decoration-dotted"
            >
              {adRow.adsetName}
            </Link>
            {" · "}ID externo:{" "}
            <span className="font-mono">{adRow.externalId}</span>
          </p>
        </div>
        <a
          href={`https://www.facebook.com/adsmanager/manage/ads?act=&selected_ad_ids=${adRow.externalId}`}
          target="_blank"
          rel="noreferrer"
          className="rounded border border-border bg-bg-raised px-3 py-1.5 text-sm hover:bg-bg-hover"
        >
          Abrir en Meta Ads ↗
        </a>
      </header>

      {adRow.verdictReason && (
        <div className="mb-6 rounded border border-border bg-bg-raised p-4">
          <div className="text-xs uppercase tracking-wider text-text-muted">
            Recomendación del motor
          </div>
          <p className="mt-1">{adRow.verdictReason}</p>
        </div>
      )}

      <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Gasto" value={formatUsd(m.spend)} />
        <StatCard label="Revenue" value={formatUsd(m.revenue)} />
        <StatCard label="ROAS" value={formatRoas(roas)} />
        <StatCard label="Compras" value={formatInt(m.purchases)} />
        <StatCard label="Impresiones" value={formatInt(m.impressions)} />
        <StatCard label="Clicks" value={formatInt(m.clicks)} />
        <StatCard label="CTR" value={formatPct(ctr, 2)} />
        <StatCard
          label="Frecuencia"
          value={m.frequency !== null ? m.frequency.toFixed(2) : "—"}
        />
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold">Línea temporal</h2>
        <div className="overflow-auto rounded border border-border bg-bg-raised">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
                <th className="px-3 py-2">Día</th>
                <th className="px-3 py-2 text-right">Spend</th>
                <th className="px-3 py-2 text-right">Revenue</th>
                <th className="px-3 py-2 text-right">ROAS</th>
                <th className="px-3 py-2 text-right">Compras</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {timeseries.map((t) => {
                const r = t.spend > 0 ? t.revenue / t.spend : 0;
                return (
                  <tr key={t.date} className="border-b border-border/50">
                    <td className="px-3 py-1.5">{t.date}</td>
                    <td className="px-3 py-1.5 text-right">{formatUsd(t.spend)}</td>
                    <td className="px-3 py-1.5 text-right">{formatUsd(t.revenue)}</td>
                    <td className="px-3 py-1.5 text-right">{formatRoas(r)}</td>
                    <td className="px-3 py-1.5 text-right">{t.purchases}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold">Análisis creativo</h2>
        {analysis ? (
          <div className="rounded border border-border bg-bg-raised p-4">
            <dl className="grid gap-3 md:grid-cols-2">
              <Field label="Hook" value={analysis.hook} />
              <Field label="Ángulo" value={analysis.angle} />
              <Field label="Formato" value={analysis.format} />
              <Field label="Pacing" value={analysis.pacing} />
              <Field label="Audio" value={analysis.audioType} />
              <Field label="CTA" value={analysis.cta} />
            </dl>
          </div>
        ) : (
          <div className="rounded border border-border bg-bg-raised p-6 text-center">
            <p className="mb-3 text-text-secondary">
              Sin análisis creativo. Pega un link o sube el video para analizarlo.
            </p>
            <button className="rounded bg-verdict-winner px-4 py-2 text-sm font-medium text-bg">
              Analizar creativo
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-text-muted">{label}</dt>
      <dd className="mt-0.5">{value ?? "—"}</dd>
    </div>
  );
}
