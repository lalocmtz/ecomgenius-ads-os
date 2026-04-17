/**
 * Display formatters — currency, percentages, dates.
 */

export function formatUsd(amount: number, opts: { precision?: number } = {}): string {
  const p = opts.precision ?? 2;
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: p,
    maximumFractionDigits: p,
  })}`;
}

export function formatRoas(roas: number): string {
  return `${roas.toFixed(2)}x`;
}

export function formatPct(pct: number, precision = 1): string {
  return `${pct.toFixed(precision)}%`;
}

export function formatInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}
