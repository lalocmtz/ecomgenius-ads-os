"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { VerdictBadge } from "@/components/ui/VerdictBadge";
import { cn } from "@/lib/utils/cn";
import {
  formatInt,
  formatPct,
  formatRoas,
  formatUsd,
} from "@/lib/utils/format";
import type { AdVerdict } from "@/lib/rules-engine/types";

export interface CreativoRow {
  adId: string;
  adName: string;
  adsetName: string;
  campaignName: string | null;
  verdict: AdVerdict | null;
  spendUsd: number;
  revenueUsd: number;
  purchases: number;
  impressions: number;
  roas: number;
  hookRatePct: number | null;
  frequency: number | null;
}

const VERDICT_OPTIONS: Array<AdVerdict | "ALL"> = [
  "ALL",
  "WINNER",
  "PROMISING",
  "BORDERLINE",
  "LOSER",
  "INCONCLUSO",
  "KILLED",
];

type SortKey = "roas" | "spend" | "purchases" | "hook";

const SORT_LABELS: Record<SortKey, string> = {
  roas: "ROAS",
  spend: "Gasto",
  purchases: "Compras",
  hook: "Hook rate",
};

export function CreativosClient({
  brandSlug,
  rows,
  minRoas,
}: {
  brandSlug: string;
  rows: CreativoRow[];
  minRoas: number;
}) {
  const [verdictFilter, setVerdictFilter] = useState<AdVerdict | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("roas");
  const [onlySpending, setOnlySpending] = useState(true);

  const filtered = useMemo(() => {
    let out = rows;
    if (onlySpending) out = out.filter((r) => r.spendUsd > 0);
    if (verdictFilter !== "ALL") {
      out = out.filter((r) => r.verdict === verdictFilter);
    }
    return [...out].sort((a, b) => {
      switch (sortKey) {
        case "roas":
          return b.roas - a.roas;
        case "spend":
          return b.spendUsd - a.spendUsd;
        case "purchases":
          return b.purchases - a.purchases;
        case "hook":
          return (b.hookRatePct ?? -1) - (a.hookRatePct ?? -1);
      }
    });
  }, [rows, verdictFilter, sortKey, onlySpending]);

  const winners = useMemo(
    () => rows.filter((r) => r.verdict === "WINNER" && r.spendUsd > 0),
    [rows],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: 0 };
    for (const r of rows) {
      if (onlySpending && r.spendUsd === 0) continue;
      c.ALL = (c.ALL ?? 0) + 1;
      const k = r.verdict ?? "INCONCLUSO";
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [rows, onlySpending]);

  return (
    <div className="space-y-6">
      {winners.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-verdict-winner">
            Winners ({winners.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {winners.slice(0, 6).map((row) => (
              <CreativoCard
                key={`w-${row.adId}`}
                row={row}
                brandSlug={brandSlug}
                minRoas={minRoas}
                highlight
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            Todos ({filtered.length})
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={onlySpending}
                onChange={(e) => setOnlySpending(e.target.checked)}
                className="accent-verdict-promising"
              />
              Solo con gasto
            </label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-md border border-border bg-bg-raised px-2 py-1 text-xs"
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  Ordenar: {SORT_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-1">
          {VERDICT_OPTIONS.map((v) => {
            const active = verdictFilter === v;
            const count = counts[v] ?? 0;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setVerdictFilter(v)}
                className={cn(
                  "rounded-md border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition",
                  active
                    ? "border-verdict-promising bg-verdict-promising text-white"
                    : "border-border bg-bg-raised text-text-secondary hover:bg-bg-hover",
                )}
              >
                {v === "ALL" ? "Todos" : v} · {count}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-bg-raised p-8 text-center text-sm text-text-secondary">
            Sin anuncios que coincidan con los filtros.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((row) => (
              <CreativoCard
                key={row.adId}
                row={row}
                brandSlug={brandSlug}
                minRoas={minRoas}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function roasColor(roas: number, minRoas: number): string {
  if (roas === 0) return "text-text-muted";
  if (roas >= minRoas * 1.2) return "text-verdict-winner";
  if (roas >= minRoas) return "text-verdict-promising";
  if (roas >= minRoas * 0.7) return "text-verdict-borderline";
  return "text-verdict-loser";
}

function CreativoCard({
  row,
  brandSlug,
  minRoas,
  highlight,
}: {
  row: CreativoRow;
  brandSlug: string;
  minRoas: number;
  highlight?: boolean;
}) {
  return (
    <Link
      href={`/${brandSlug}/ads/${row.adId}`}
      className={cn(
        "group flex flex-col gap-3 rounded-lg border bg-bg-raised p-4 transition hover:bg-bg-hover",
        highlight
          ? "border-verdict-winner/40 bg-verdict-winner/5"
          : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold group-hover:text-verdict-promising">
            {row.adName}
          </h3>
          <p className="mt-0.5 truncate text-[11px] text-text-muted">
            {row.adsetName}
            {row.campaignName ? ` · ${row.campaignName}` : ""}
          </p>
        </div>
        {row.verdict && <VerdictBadge verdict={row.verdict} />}
      </div>

      <dl className="grid grid-cols-3 gap-2 text-xs">
        <Stat
          label="ROAS"
          value={formatRoas(row.roas)}
          className={roasColor(row.roas, minRoas)}
        />
        <Stat label="Spend" value={formatUsd(row.spendUsd)} />
        <Stat label="Compras" value={formatInt(row.purchases)} />
        <Stat
          label="Hook"
          value={row.hookRatePct === null ? "—" : formatPct(row.hookRatePct, 1)}
        />
        <Stat
          label="Freq."
          value={row.frequency === null ? "—" : row.frequency.toFixed(2)}
        />
        <Stat label="Impr." value={formatInt(row.impressions)} />
      </dl>
    </Link>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <dt className="text-[9px] uppercase tracking-wider text-text-muted">
        {label}
      </dt>
      <dd className={cn("font-mono", className)}>{value}</dd>
    </div>
  );
}
