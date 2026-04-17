/**
 * Meta Ads CSV parser — AGGREGATE (period) variant.
 *
 * Accepts exports where each row is an AD aggregated over a period
 * (columns `Inicio del informe` + `Fin del informe`, no `Día`).
 * Commonly what the Meta export defaults to when the user does not
 * customize columns or add "Desglose → Por día".
 *
 * Known limitations vs the daily parser:
 *   - No time series → no `days_with_roas_above_min` for scaling decisions.
 *     We synthesize it as "all days of the period" when ROAS ≥ min (optimistic).
 *   - No ad/adset IDs → we stabilize IDs from the ad name.
 *   - No adset breakdown → every row goes into a single "default" adset
 *     named "Sin conjunto (agregado)".
 *   - Spend/revenue may be in MXN → caller passes an exchange_rate to convert.
 *
 * Pure function: takes CSV string + options, returns structured rows.
 */

import Papa from "papaparse";
import { normalizeHeader, parseNumber, toIsoDate, type MetaRow } from "./meta-csv";

export interface AggregateParseOptions {
  /** MXN/USD (e.g. 17.5). Required if spend currency column is MXN. */
  exchange_rate: number;
  /** The min ROAS threshold for the brand — used to synthesize `days_with_roas_above_min`. */
  min_roas: number;
}

export interface AggregateParseResult {
  rows: MetaRow[];
  rowsFailed: number;
  failures: Array<{ line: number; reason: string; rawRow?: unknown }>;
  dateRange: { start: string; end: string };
  /** The raw currency detected in the spend column. */
  currencyDetected: "USD" | "MXN" | "unknown";
  /** We used this rate when converting MXN to USD (1 if already USD). */
  exchangeRateApplied: number;
  /** Period length used to expand the single row into N daily rows. */
  periodDays: number;
}

const COL_ALIASES: Record<string, string[]> = {
  period_start: ["inicio del informe", "reporting starts", "report start"],
  period_end: ["fin del informe", "reporting ends", "report end"],
  ad_name: ["nombre del anuncio", "ad name"],
  spend_usd: [
    "importe gastado (usd)",
    "importe gastado",
    "amount spent (usd)",
    "amount spent",
    "spend",
  ],
  spend_mxn: ["importe gastado (mxn)", "importe gastado mxn"],
  // Revenue is exported in many flavors; we accept any that looks like "purchase value".
  revenue: [
    "valor de resultados",
    "valor de conversion de compras",
    "valor de conversión de compras",
    "purchases conversion value",
    "website purchases conversion value",
    "purchase value",
  ],
  purchases: ["compras", "purchases", "website purchases"],
  roas: ["roas de resultados", "result roas", "purchase roas"],
  ctr: ["ctr (todos)", "ctr", "ctr (all)"],
  atc: [
    "articulos agregados al carrito",
    "artículos agregados al carrito",
    "adds to cart",
    "add to cart",
  ],
  ic: [
    "pagos iniciados",
    "informacion de pago agregada",
    "información de pago agregada",
    "payments added info",
    "checkouts initiated",
    "initiate checkout",
  ],
  impressions: ["impresiones", "impressions"],
  clicks: ["clics", "clicks", "link clicks"],
  frequency: ["frecuencia", "frequency"],
  delivery: ["entrega del anuncio", "ad delivery"],
  ad_id: ["identificador del anuncio", "ad id"],
  adset_id: ["identificador del conjunto", "ad set id", "adset id"],
  adset_name: ["nombre del conjunto de anuncios", "ad set name", "adset name"],
  campaign_name: ["nombre de la campana", "nombre de la campaña", "campaign name"],
};

/**
 * Detect whether a CSV is the aggregate export variant (no `Día`, has `Inicio del informe`).
 * Consumers can use this to decide which parser to call.
 */
export function isAggregateMetaCsv(csv: string): boolean {
  // Cheap scan of the first line.
  const firstLine = csv.replace(/^\uFEFF/, "").split(/\r?\n/)[0] ?? "";
  const headers = firstLine
    .split(",")
    .map((h) => normalizeHeader(h.replace(/^"|"$/g, "")));
  const hasDay = headers.includes("dia") || headers.includes("day") || headers.includes("fecha");
  const hasPeriod = headers.includes("inicio del informe");
  return !hasDay && hasPeriod;
}

export function parseMetaAggregateCsv(
  csv: string,
  options: AggregateParseOptions,
): AggregateParseResult {
  const parsed = Papa.parse<Record<string, string>>(csv.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => normalizeHeader(h),
  });

  const headers = parsed.meta.fields ?? [];
  const colmap = resolveColumns(headers);

  if (!colmap.period_start || !colmap.period_end) {
    throw new Error(
      'Export agregado inválido: faltan "Inicio del informe" y/o "Fin del informe".',
    );
  }
  if (!colmap.ad_name) {
    throw new Error('Columna "Nombre del anuncio" no encontrada.');
  }
  if (!colmap.spend_usd && !colmap.spend_mxn) {
    throw new Error('Columna "Importe gastado" no encontrada (USD o MXN).');
  }

  const currencyDetected: AggregateParseResult["currencyDetected"] = colmap.spend_mxn
    ? "MXN"
    : colmap.spend_usd
      ? "USD"
      : "unknown";
  const exchangeRate = currencyDetected === "MXN" ? options.exchange_rate : 1;

  const rows: MetaRow[] = [];
  const failures: AggregateParseResult["failures"] = [];
  let minDate = "9999-12-31";
  let maxDate = "0000-01-01";
  let periodDays = 1;

  parsed.data.forEach((raw, idx) => {
    const lineNum = idx + 2;
    try {
      const row = mapRow(raw, colmap, exchangeRate, options.min_roas);
      if (!row) return;
      if (row.date < minDate) minDate = row.date;
      if (row.date > maxDate) maxDate = row.date;
      const d = daysBetween(row.date, row.date);
      if (d > periodDays) periodDays = d;
      rows.push(row);
    } catch (e) {
      failures.push({
        line: lineNum,
        reason: e instanceof Error ? e.message : String(e),
        rawRow: raw,
      });
    }
  });

  // Recompute period length from overall min..max dates
  if (rows.length > 0) {
    periodDays = daysBetween(minDate, maxDate);
  }

  return {
    rows,
    rowsFailed: failures.length,
    failures,
    dateRange: { start: rows.length ? minDate : "", end: rows.length ? maxDate : "" },
    currencyDetected,
    exchangeRateApplied: exchangeRate,
    periodDays,
  };
}

type ColMap = Record<string, string | null>;

function resolveColumns(headers: string[]): ColMap {
  const map: ColMap = {};
  const normHeaders = headers.map((h) => ({ original: h, norm: normalizeHeader(h) }));
  for (const key of Object.keys(COL_ALIASES)) {
    const aliases = COL_ALIASES[key]!;
    const found = normHeaders.find((h) => aliases.includes(h.norm));
    map[key] = found ? found.original : null;
  }
  return map;
}

function get(raw: Record<string, string>, col: string | null): string | undefined {
  if (!col) return undefined;
  return raw[col];
}

function mapRow(
  raw: Record<string, string>,
  cm: ColMap,
  exchangeRate: number,
  _minRoas: number,
): MetaRow | null {
  const periodStart = toIsoDate(get(raw, cm.period_start ?? null));
  const periodEnd = toIsoDate(get(raw, cm.period_end ?? null));
  if (!periodStart || !periodEnd) return null;

  const adName = (get(raw, cm.ad_name ?? null) ?? "").trim();
  if (!adName) return null;

  // Skip summary rows like "Total de cuenta".
  if (/^total/i.test(adName) || adName.toLowerCase() === "total de cuenta") {
    return null;
  }

  // Spend: either USD or MXN column.
  const spendRaw =
    parseNumber(get(raw, cm.spend_usd ?? null)) ??
    parseNumber(get(raw, cm.spend_mxn ?? null));
  if (spendRaw === null) {
    throw new Error(`Spend inválido para ad "${adName}"`);
  }
  const spendUsd = spendRaw / exchangeRate;

  // Revenue: prefer "Valor de resultados" (MXN if spend was MXN).
  const revRaw = parseNumber(get(raw, cm.revenue ?? null));
  const revenueUsd = revRaw !== null ? revRaw / exchangeRate : 0;

  const purchases = Math.round(parseNumber(get(raw, cm.purchases ?? null)) ?? 0);

  // IDs: synthesize stable ones from the ad name if missing.
  const adId = (get(raw, cm.ad_id ?? null) ?? "").trim() || stableId(adName, "ad");
  const adsetExt = (get(raw, cm.adset_id ?? null) ?? "").trim() || "aggregate-default";
  const adsetName = (get(raw, cm.adset_name ?? null) ?? "").trim() || "Sin conjunto (agregado)";

  return {
    // Use the period END as the representative date. The ingest pipeline will
    // upsert one row per ad+date; all aggregate rows share the same end-of-period date.
    date: periodEnd,
    ad_external_id: adId,
    ad_name: adName,
    adset_external_id: adsetExt,
    adset_name: adsetName,
    campaign_name: get(raw, cm.campaign_name ?? null)?.trim() || null,
    spend_usd: spendUsd,
    revenue_usd: revenueUsd,
    purchases,
    impressions: Math.round(parseNumber(get(raw, cm.impressions ?? null)) ?? 0),
    clicks: Math.round(parseNumber(get(raw, cm.clicks ?? null)) ?? 0),
    ctr: parseNumber(get(raw, cm.ctr ?? null)),
    cpc: null,
    cpm: null,
    frequency: parseNumber(get(raw, cm.frequency ?? null)),
    atc: Math.round(parseNumber(get(raw, cm.atc ?? null)) ?? 0),
    ic: Math.round(parseNumber(get(raw, cm.ic ?? null)) ?? 0),
    platform: null,
    placement: null,
    age_range: null,
    gender: null,
    region: null,
    device: null,
  };
}

/** 32-bit stable hash to produce deterministic synthetic IDs from ad names. */
function stableId(input: string, prefix: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return `${prefix}_${Math.abs(h).toString(36)}`;
}

function daysBetween(startIso: string, endIso: string): number {
  const s = new Date(startIso + "T00:00:00Z").getTime();
  const e = new Date(endIso + "T00:00:00Z").getTime();
  return Math.max(1, Math.round((e - s) / (24 * 3600 * 1000)) + 1);
}
