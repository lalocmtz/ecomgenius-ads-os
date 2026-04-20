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

/** Format a USD amount in the requested display currency.
 *  currency="MXN" multiplies by exchangeRate and appends " MXN".
 *  Never use this for dimensionless ratios (ROAS, CTR, frequency). */
export function formatMoney(
  usdAmount: number,
  currency: "USD" | "MXN",
  exchangeRate: number,
): string {
  if (currency === "MXN") {
    const mxn = usdAmount * exchangeRate;
    return `$${mxn.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })} MXN`;
  }
  return formatUsd(usdAmount);
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
