import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getGlobalSummary,
  getPendingRecommendations,
  getRecentUploads,
  getTopAds,
} from "@/lib/db/queries/app";
import { StatCard } from "@/components/ui/StatCard";
import { VerdictBadge } from "@/components/ui/VerdictBadge";
import { formatUsd, formatRoas, formatInt } from "@/lib/utils/format";
import type { AdVerdict } from "@/lib/rules-engine/types";
import { ArrowRight, Upload, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  kill: "Apagar",
  rotate: "Rotar",
  iterate: "Iterar",
  let_run: "Dejar correr",
  keep: "Mantener",
  pause: "Pausar conjunto",
  hold: "Hold",
  test_new_creatives: "Test creativos",
  scale_up: "Escalar",
};

const ACTION_TONE: Record<string, string> = {
  kill: "text-verdict-loser",
  rotate: "text-verdict-borderline",
  iterate: "text-verdict-inconcluso",
  let_run: "text-verdict-promising",
  keep: "text-text-secondary",
  pause: "text-verdict-loser",
  hold: "text-text-secondary",
  test_new_creatives: "text-verdict-borderline",
  scale_up: "text-verdict-winner",
};

export default async function Dashboard() {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const [summary, pending, uploads, winners, losers] = await Promise.all([
    getGlobalSummary(userId),
    getPendingRecommendations(userId, 8),
    getRecentUploads(userId, 5),
    getTopAds(userId, { order: "winner", limit: 5 }),
    getTopAds(userId, { order: "loser", limit: 5 }),
  ]);

  const hasData = summary.totals.adsCount > 0;
  const brandBySlug = new Map(summary.brands.map((b) => [b.id, b]));

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-text-secondary">
            {summary.brands.length > 0
              ? `${summary.brands.length} marca${summary.brands.length === 1 ? "" : "s"} · ${summary.totals.adsCount} ads · ${summary.totals.adsetsCount} conjuntos`
              : "No hay marcas configuradas aún"}
          </p>
        </div>
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 rounded-md bg-verdict-winner px-4 py-2 text-sm font-medium text-bg hover:bg-verdict-winner/90"
        >
          <Upload className="h-4 w-4" />
          Subir CSV
        </Link>
      </header>

      {!hasData && summary.brands.length > 0 && (
        <div className="rounded-lg border border-verdict-promising/40 bg-verdict-promising/5 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-verdict-promising" />
            <div>
              <h3 className="font-semibold">Aún no hay datos</h3>
              <p className="mt-1 text-sm text-text-secondary">
                Exporta el CSV desde Meta Ads Manager (Desglose → Por día) y súbelo desde{" "}
                <Link href="/upload" className="underline">
                  Carga de datos
                </Link>{" "}
                para ver recomendaciones.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Global KPIs */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Gasto total" value={formatUsd(summary.totals.spend)} />
        <StatCard label="Revenue" value={formatUsd(summary.totals.revenue)} />
        <StatCard
          label="ROAS global"
          value={formatRoas(summary.totals.roas)}
          delta={
            summary.totals.roas > 0
              ? {
                  direction: summary.totals.roas >= 2 ? "up" : "down",
                  label: summary.totals.roas >= 2 ? "sobre objetivo" : "bajo objetivo",
                }
              : undefined
          }
        />
        <StatCard label="Compras" value={formatInt(summary.totals.purchases)} />
      </section>

      {/* Brands overview */}
      {summary.brands.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Marcas</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {summary.brands.map((b) => (
              <Link
                key={b.id}
                href={`/${b.slug}`}
                className="group rounded-lg border border-border bg-bg-raised p-5 transition hover:border-verdict-promising/40 hover:bg-bg-hover"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{b.name}</h3>
                    <p className="text-xs uppercase tracking-wider text-text-muted">
                      /{b.slug}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-text-muted group-hover:text-text-primary" />
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-3">
                  <Metric label="Gasto" value={formatUsd(b.spend_usd)} />
                  <Metric label="Revenue" value={formatUsd(b.revenue_usd)} />
                  <Metric
                    label="ROAS"
                    value={formatRoas(b.roas)}
                    tone={b.roas >= 2 ? "win" : b.roas >= 1.5 ? "warn" : b.roas > 0 ? "lose" : "muted"}
                  />
                </dl>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pending actions */}
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">Acciones pendientes</h2>
          {pending.length === 0 ? (
            <EmptyCard message="No hay recomendaciones pendientes." />
          ) : (
            <div className="space-y-2">
              {pending.map((r) => {
                const brand = brandBySlug.get(r.brandId);
                return (
                  <Link
                    key={r.id}
                    href={brand ? `/${brand.slug}` : "/"}
                    className="block rounded-md border border-border bg-bg-raised px-4 py-3 text-sm transition hover:bg-bg-hover"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono text-[10px] uppercase tracking-widest ${ACTION_TONE[r.action] ?? ""}`}
                          >
                            {ACTION_LABELS[r.action] ?? r.action}
                          </span>
                          <span className="text-xs text-text-muted">{brand?.name ?? "—"}</span>
                        </div>
                        <p className="mt-1 truncate text-text-secondary">{r.reason}</p>
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-text-muted" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Right rail */}
        <section className="space-y-6">
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-text-muted">
              <TrendingUp className="h-4 w-4 text-verdict-winner" /> Top winners
            </h2>
            {winners.length === 0 ? (
              <EmptyCard message="Aún sin ads testeados." compact />
            ) : (
              <ul className="space-y-2">
                {winners.map((a) => (
                  <AdRow key={a.adId} ad={a} brand={brandBySlug.get(a.brandId)} />
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-text-muted">
              <TrendingDown className="h-4 w-4 text-verdict-loser" /> Ads en riesgo
            </h2>
            {losers.length === 0 ? (
              <EmptyCard message="Sin ads en riesgo." compact />
            ) : (
              <ul className="space-y-2">
                {losers.map((a) => (
                  <AdRow key={a.adId} ad={a} brand={brandBySlug.get(a.brandId)} />
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
              Ingestas recientes
            </h2>
            {uploads.length === 0 ? (
              <EmptyCard message="Sin CSVs cargados." compact />
            ) : (
              <ul className="space-y-1 text-sm">
                {uploads.map((u) => (
                  <li
                    key={u.id}
                    className="flex justify-between rounded border border-border bg-bg-raised px-3 py-2"
                  >
                    <span className="truncate font-mono text-xs">{u.filename}</span>
                    <span className="text-xs text-text-muted">
                      {u.rowsProcessed} filas
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "win" | "warn" | "lose" | "muted";
}) {
  const toneClass =
    tone === "win"
      ? "text-verdict-winner"
      : tone === "warn"
        ? "text-verdict-borderline"
        : tone === "lose"
          ? "text-verdict-loser"
          : "text-text-primary";
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-text-muted">{label}</dt>
      <dd className={`mt-0.5 font-mono text-sm ${toneClass}`}>{value}</dd>
    </div>
  );
}

function EmptyCard({ message, compact }: { message: string; compact?: boolean }) {
  return (
    <div
      className={`rounded border border-dashed border-border bg-bg-raised text-center text-sm text-text-muted ${
        compact ? "px-3 py-4" : "px-4 py-8"
      }`}
    >
      {message}
    </div>
  );
}

function AdRow({
  ad,
  brand,
}: {
  ad: {
    adId: string;
    adName: string;
    adsetName: string;
    verdict: string | null;
    spend: number;
    roas: number;
  };
  brand: { slug: string; name: string } | undefined;
}) {
  return (
    <li className="rounded border border-border bg-bg-raised px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={brand ? `/${brand.slug}/ads/${ad.adId}` : "#"}
          className="min-w-0 flex-1 truncate hover:underline"
          title={ad.adName}
        >
          {ad.adName}
        </Link>
        {ad.verdict && <VerdictBadge verdict={ad.verdict as AdVerdict} />}
      </div>
      <div className="mt-1 flex justify-between text-xs text-text-muted">
        <span className="truncate">{brand?.name}</span>
        <span className="font-mono">
          {formatRoas(ad.roas)} · {formatUsd(ad.spend)}
        </span>
      </div>
    </li>
  );
}
