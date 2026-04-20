"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { VerdictBadge } from "@/components/ui/VerdictBadge";
import { formatInt, formatPct, formatRoas, formatUsd } from "@/lib/utils/format";
import type { AdRow, AdsetRow } from "@/lib/db/queries/dashboard";
import type { AdVerdict } from "@/lib/rules-engine/types";

type ActionKey = "SCALE_UP" | "HOLD" | "PAUSE" | "TEST_NEW_CREATIVES" | "DESCALE";

const ACTION_STYLES: Record<ActionKey, { label: string; classes: string }> = {
  SCALE_UP: { label: "ESCALAR", classes: "bg-verdict-winner text-white" },
  HOLD: { label: "HOLD", classes: "bg-verdict-borderline text-bg" },
  PAUSE: { label: "PAUSAR", classes: "bg-verdict-loser text-white" },
  TEST_NEW_CREATIVES: {
    label: "TESTEAR CREATIVOS",
    classes: "bg-verdict-promising text-white",
  },
  DESCALE: { label: "DESESCALAR", classes: "bg-verdict-borderline text-bg" },
};

export interface AdsetCardProps {
  brandSlug: string;
  adset: AdsetRow;
  action: ActionKey | null;
  actionReason: string | null;
  ads: AdRow[];
  minRoas: number;
  initiallyOpen?: boolean;
}

function roasColorClass(roas: number, minRoas: number): string {
  if (roas === 0) return "text-text-muted";
  if (roas >= minRoas * 1.2) return "text-verdict-winner";
  if (roas >= minRoas) return "text-verdict-promising";
  if (roas >= minRoas * 0.7) return "text-verdict-borderline";
  return "text-verdict-loser";
}

export function AdsetCard({
  brandSlug,
  adset,
  action,
  actionReason,
  ads,
  minRoas,
  initiallyOpen = false,
}: AdsetCardProps) {
  const [open, setOpen] = useState(initiallyOpen);
  const roasClass = roasColorClass(adset.roas, minRoas);
  const style = action ? ACTION_STYLES[action] : null;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-bg-raised">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-bg-hover"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{adset.adsetName}</span>
            {style && (
              <span
                className={cn(
                  "inline-flex shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
                  style.classes,
                )}
              >
                {style.label}
              </span>
            )}
          </div>
          {adset.campaignName && (
            <div className="truncate text-xs text-text-muted">
              {adset.campaignName}
            </div>
          )}
        </div>
        <div className="hidden shrink-0 items-baseline gap-6 text-right font-mono text-sm sm:flex">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              Spend
            </div>
            <div>{formatUsd(adset.spendUsd)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              Purch.
            </div>
            <div>{formatInt(adset.purchases)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              ROAS
            </div>
            <div className={cn("font-semibold", roasClass)}>
              {formatRoas(adset.roas)}
            </div>
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-border bg-bg/40 px-4 py-3">
          {actionReason && (
            <p className="mb-3 text-xs text-text-secondary">
              <span className="font-mono uppercase tracking-wider text-text-muted">
                Motivo:
              </span>{" "}
              {actionReason}
            </p>
          )}
          <AdsetMetricsStrip adset={adset} minRoas={minRoas} />
          {ads.length === 0 ? (
            <p className="mt-3 text-xs text-text-muted">
              Sin anuncios activos en el período.
            </p>
          ) : (
            <AdsTable brandSlug={brandSlug} ads={ads} minRoas={minRoas} />
          )}
        </div>
      )}
    </div>
  );
}

function AdsetMetricsStrip({
  adset,
  minRoas,
}: {
  adset: AdsetRow;
  minRoas: number;
}) {
  const ctrPct = adset.ctr !== null ? adset.ctr * 100 : null;
  return (
    <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-6">
      <Metric label="Rev" value={formatUsd(adset.revenueUsd)} />
      <Metric
        label="ROAS"
        value={formatRoas(adset.roas)}
        className={roasColorClass(adset.roas, minRoas)}
      />
      <Metric label="Impr." value={formatInt(adset.impressions)} />
      <Metric label="CTR" value={ctrPct === null ? "—" : formatPct(ctrPct, 2)} />
      <Metric
        label="Freq."
        value={adset.frequency === null ? "—" : adset.frequency.toFixed(2)}
      />
      <Metric
        label="Días"
        value={`${adset.daysWithData} (${adset.daysWithRoasAboveMin}↑)`}
      />
    </dl>
  );
}

function Metric({
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
      <dt className="text-[10px] uppercase tracking-wider text-text-muted">
        {label}
      </dt>
      <dd className={cn("font-mono", className)}>{value}</dd>
    </div>
  );
}

function AdsTable({
  brandSlug,
  ads,
  minRoas,
}: {
  brandSlug: string;
  ads: AdRow[];
  minRoas: number;
}) {
  return (
    <div className="mt-3 overflow-hidden rounded border border-border">
      <table className="w-full text-xs">
        <thead className="border-b border-border bg-bg/60">
          <tr className="text-left uppercase tracking-wider text-text-muted">
            <th className="px-3 py-2 font-normal">Anuncio</th>
            <th className="px-3 py-2 font-normal">Verdict</th>
            <th className="px-3 py-2 text-right font-normal">Spend</th>
            <th className="px-3 py-2 text-right font-normal">Purch.</th>
            <th className="px-3 py-2 text-right font-normal">ROAS</th>
            <th className="px-3 py-2 text-right font-normal">Hook</th>
            <th className="px-3 py-2 text-right font-normal">Freq.</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {ads.map((ad) => {
            const roasClass = roasColorClass(ad.roas, minRoas);
            return (
              <tr
                key={ad.adId}
                className="border-b border-border/60 last:border-0"
              >
                <td className="px-3 py-2 font-medium">{ad.adName}</td>
                <td className="px-3 py-2">
                  {ad.verdict ? (
                    <VerdictBadge verdict={ad.verdict as AdVerdict} />
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {formatUsd(ad.spendUsd)}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {formatInt(ad.purchases)}
                </td>
                <td className={cn("px-3 py-2 text-right font-mono", roasClass)}>
                  {formatRoas(ad.roas)}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {ad.hookRatePct === null ? "—" : formatPct(ad.hookRatePct, 1)}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {ad.frequency === null ? "—" : ad.frequency.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/${brandSlug}/ads/${ad.adId}`}
                    className="text-verdict-promising hover:underline"
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
