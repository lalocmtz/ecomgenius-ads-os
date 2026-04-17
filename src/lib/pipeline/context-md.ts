/**
 * Context .md exporter — PRD criterion §13.8.
 *
 * Regenerates the Auditor-compatible markdown context for a brand
 * after a CSV upload. Pure function.
 */

import type { BrandThresholds } from "@/lib/rules-engine/types";

export interface ContextSection {
  title: string;
  body: string;
}

export interface BuildContextMdInput {
  brandName: string;
  brandSlug: string;
  periodLabel: string; // e.g. "Abril 2026"
  thresholds: BrandThresholds;
  accountSummary: {
    spend_usd: number;
    revenue_usd: number;
    purchases: number;
    roas: number;
  };
  winners: Array<{ name: string; roas: number; spend_usd: number; purchases: number }>;
  losers: Array<{ name: string; spend_usd: number; reason: string }>;
  adsetActions: Array<{ name: string; action: string; reason: string }>;
  openQuestions?: string[];
}

export function buildContextMd(input: BuildContextMdInput): string {
  const money = (n: number) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const roas = (n: number) => `${n.toFixed(2)}x`;

  const lines: string[] = [];
  lines.push(`# Contexto ${input.brandName} — ${input.periodLabel}`);
  lines.push("");
  lines.push(`_Marca:_ ${input.brandName} (${input.brandSlug})`);
  lines.push(`_Generado:_ ${new Date().toISOString()}`);
  lines.push("");

  lines.push("## Thresholds (unit economics)");
  lines.push("");
  lines.push(`- AOV USD: ${money(input.thresholds.aov_usd)}`);
  lines.push(`- CAC target USD: ${money(input.thresholds.cac_target_usd)}`);
  lines.push(`- CAC breakeven USD: ${money(input.thresholds.cac_breakeven_usd)}`);
  lines.push(
    `- Test threshold USD (2×CAC): ${money(input.thresholds.test_threshold_usd)}`,
  );
  lines.push(`- ROAS mínimo: ${roas(input.thresholds.min_roas)}`);
  lines.push("");

  lines.push("## Cuenta (acumulado período)");
  lines.push("");
  lines.push(`- Gasto: ${money(input.accountSummary.spend_usd)}`);
  lines.push(`- Revenue: ${money(input.accountSummary.revenue_usd)}`);
  lines.push(`- Compras: ${input.accountSummary.purchases}`);
  lines.push(`- ROAS cuenta: ${roas(input.accountSummary.roas)}`);
  if (input.accountSummary.roas < input.thresholds.min_roas) {
    lines.push("");
    lines.push(
      `> ⚠️ ROAS cuenta bajo mínimo. Freno a escalamientos hasta recuperar.`,
    );
  }
  lines.push("");

  if (input.winners.length > 0) {
    lines.push("## Winners");
    lines.push("");
    for (const w of input.winners) {
      lines.push(
        `- **${w.name}** — ROAS ${roas(w.roas)}, gasto ${money(w.spend_usd)}, compras ${w.purchases}`,
      );
    }
    lines.push("");
  }

  if (input.losers.length > 0) {
    lines.push("## Losers / Apagar");
    lines.push("");
    for (const l of input.losers) {
      lines.push(`- **${l.name}** — ${money(l.spend_usd)}. ${l.reason}`);
    }
    lines.push("");
  }

  if (input.adsetActions.length > 0) {
    lines.push("## Acciones por conjunto");
    lines.push("");
    for (const a of input.adsetActions) {
      lines.push(`- **${a.name}** → ${a.action}. ${a.reason}`);
    }
    lines.push("");
  }

  if (input.openQuestions && input.openQuestions.length > 0) {
    lines.push("## Preguntas abiertas");
    lines.push("");
    for (const q of input.openQuestions) lines.push(`- ${q}`);
    lines.push("");
  }

  lines.push("---");
  lines.push("_Generado por EcomGenius Ads OS — motor de reglas v1._");
  return lines.join("\n");
}
