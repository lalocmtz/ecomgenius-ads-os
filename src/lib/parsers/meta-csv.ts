/**
 * Meta Ads CSV parser — PRD §6.1.
 *
 * Expects a CSV exported with "Desglose → Por día" in Meta Ads Manager.
 * Tolerant of:
 *   - UTF-8 or Windows-1252 (BOM detection is the consumer's job).
 *   - Localized column names (ES / EN variants).
 *   - Optional breakdown columns (age/gender/platform/placement/region/device).
 *
 * NOT tolerant of:
 *   - Missing `Día` column.
 *   - Rows where the `spend` column can't be parsed as a number.
 *
 * Pure function: takes a string, returns structured rows or errors.
 * I/O happens outside.
 */

import Papa from "papaparse";

// --------------------------------------
// Types
// --------------------------------------
export interface MetaRow {
  date: string; // YYYY-MM-DD
  ad_external_id: string;
  ad_name: string;
  adset_external_id: string;
  adset_name: string;
  campaign_name: string | null;
  spend_usd: number;
  revenue_usd: number;
  purchases: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  frequency: number | null;
  atc: number;
  ic: number;
  // Breakdowns
  platform: string | null;
  placement: string | null;
  age_range: string | null;
  gender: string | null;
  region: string | null;
  device: string | null;
}

export interface MetaParseResult {
  rows: MetaRow[];
  rowsFailed: number;
  failures: Array<{ line: number; reason: string; rawRow?: unknown }>;
  dateRange: { start: string; end: string };
  hasBreakdowns: {
    platform: boolean;
    placement: boolean;
    age: boolean;
    gender: boolean;
    region: boolean;
    device: boolean;
  };
}

// --------------------------------------
// Column aliases (EN / ES, short / long forms)
// --------------------------------------
// Normalization: lowercase + strip accents + collapse whitespace.
export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const COL_ALIASES: Record<string, string[]> = {
  date: ["dia", "day", "fecha", "date"],
  ad_name: ["nombre del anuncio", "ad name"],
  ad_id: [
    "identificador del anuncio",
    "id del anuncio",
    "ad id",
    "id de anuncio",
  ],
  adset_name: [
    "nombre del conjunto de anuncios",
    "ad set name",
    "adset name",
  ],
  adset_id: [
    "identificador del conjunto",
    "identificador del conjunto de anuncios",
    "ad set id",
    "adset id",
  ],
  campaign_name: ["nombre de la campana", "nombre de la campaña", "campaign name"],
  spend_usd: [
    "importe gastado (usd)",
    "importe gastado",
    "amount spent (usd)",
    "amount spent",
    "spend",
  ],
  purchases: ["compras", "purchases", "website purchases"],
  revenue_usd: [
    "valor de conversion de compras",
    "valor de conversión de compras",
    "purchases conversion value",
    "website purchases conversion value",
  ],
  impressions: ["impresiones", "impressions"],
  clicks: ["clics", "clics (todos)", "clicks", "link clicks", "clicks (all)"],
  ctr: ["ctr", "ctr (todos)", "ctr (all)"],
  cpc: ["cpc", "cpc (todos)", "cpc (all)"],
  cpm: ["cpm"],
  frequency: ["frecuencia", "frequency"],
  atc: [
    "articulos agregados al carrito",
    "artículos agregados al carrito",
    "adds to cart",
    "add to cart",
  ],
  ic: ["pagos iniciados", "checkouts initiated", "initiate checkout"],
  platform: ["plataforma", "platform", "publisher platform"],
  placement: ["ubicacion", "ubicación", "placement"],
  age_range: ["edad", "age"],
  gender: ["sexo", "genero", "género", "gender"],
  region: ["region", "región"],
  device: [
    "plataforma de dispositivos",
    "device platform",
    "dispositivo",
  ],
};

// --------------------------------------
// Parser
// --------------------------------------
export interface ParseOptions {
  /** If true, throw on unknown columns. Default: false (ignore). */
  strict?: boolean;
  /** If set, synthesize ad_external_id from (adset_id + ad_name) when column is missing. Default: false. */
  synthesizeMissingIds?: boolean;
}

export function parseMetaCsv(
  csv: string,
  options: ParseOptions = {},
): MetaParseResult {
  const parsed = Papa.parse<Record<string, string>>(csv.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => normalizeHeader(h),
  });

  if (parsed.errors.length > 0) {
    // Report lethal errors only (parsing-level). Non-lethal field errors are tolerated.
    const lethal = parsed.errors.filter((e) => e.type === "Delimiter" || e.type === "Quotes");
    if (lethal.length > 0) {
      throw new Error(`CSV parsing failed: ${lethal.map((e) => e.message).join("; ")}`);
    }
  }

  const headers = parsed.meta.fields ?? [];
  const colmap = resolveColumns(headers);

  if (!colmap.date) {
    throw new Error(
      'Exporta con breakdown por día. La columna "Día" no fue encontrada.',
    );
  }
  if (!colmap.ad_id && !options.synthesizeMissingIds) {
    throw new Error(
      'Columna "Identificador del anuncio" faltante. Exporta incluyendo los IDs.',
    );
  }
  if (!colmap.adset_id) {
    throw new Error(
      'Columna "Identificador del conjunto" faltante.',
    );
  }
  if (!colmap.spend_usd) {
    throw new Error('Columna "Importe gastado" faltante.');
  }

  const rows: MetaRow[] = [];
  const failures: MetaParseResult["failures"] = [];
  let minDate = "9999-12-31";
  let maxDate = "0000-01-01";

  parsed.data.forEach((raw, idx) => {
    const lineNum = idx + 2; // +1 for header, +1 for 1-indexed
    try {
      const row = mapRow(raw, colmap, options);
      if (!row) {
        // Aggregated rows ("Total de cuenta") or fully-empty rows → skip silently.
        return;
      }
      if (row.date < minDate) minDate = row.date;
      if (row.date > maxDate) maxDate = row.date;
      rows.push(row);
    } catch (e) {
      failures.push({
        line: lineNum,
        reason: e instanceof Error ? e.message : String(e),
        rawRow: raw,
      });
    }
  });

  return {
    rows,
    rowsFailed: failures.length,
    failures,
    dateRange: {
      start: rows.length ? minDate : "",
      end: rows.length ? maxDate : "",
    },
    hasBreakdowns: {
      platform: Boolean(colmap.platform),
      placement: Boolean(colmap.placement),
      age: Boolean(colmap.age_range),
      gender: Boolean(colmap.gender),
      region: Boolean(colmap.region),
      device: Boolean(colmap.device),
    },
  };
}

// --------------------------------------
// Helpers
// --------------------------------------
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
  options: ParseOptions,
): MetaRow | null {
  const date = toIsoDate(get(raw, cm.date ?? null));
  if (!date) {
    // Drop rows without a valid date (e.g. aggregated totals).
    return null;
  }

  const adName = (get(raw, cm.ad_name ?? null) ?? "").trim();
  const adsetName = (get(raw, cm.adset_name ?? null) ?? "").trim();
  const adsetId = (get(raw, cm.adset_id ?? null) ?? "").trim();

  if (!adsetId) {
    // Likely an aggregated/total row.
    return null;
  }

  let adId = (get(raw, cm.ad_id ?? null) ?? "").trim();
  if (!adId) {
    if (options.synthesizeMissingIds) {
      adId = `${adsetId}::${adName}`;
    } else {
      // No ad id AND not syntesizing → aggregate-ish row, drop.
      return null;
    }
  }

  const spend = parseNumber(get(raw, cm.spend_usd ?? null));
  if (spend === null) {
    throw new Error(`Spend inválido para ad ${adId}`);
  }

  return {
    date,
    ad_external_id: adId,
    ad_name: adName || `(sin nombre ${adId})`,
    adset_external_id: adsetId,
    adset_name: adsetName || `(sin nombre ${adsetId})`,
    campaign_name: get(raw, cm.campaign_name ?? null)?.trim() || null,
    spend_usd: spend,
    revenue_usd: parseNumber(get(raw, cm.revenue_usd ?? null)) ?? 0,
    purchases: Math.round(parseNumber(get(raw, cm.purchases ?? null)) ?? 0),
    impressions: Math.round(parseNumber(get(raw, cm.impressions ?? null)) ?? 0),
    clicks: Math.round(parseNumber(get(raw, cm.clicks ?? null)) ?? 0),
    ctr: parseNumber(get(raw, cm.ctr ?? null)),
    cpc: parseNumber(get(raw, cm.cpc ?? null)),
    cpm: parseNumber(get(raw, cm.cpm ?? null)),
    frequency: parseNumber(get(raw, cm.frequency ?? null)),
    atc: Math.round(parseNumber(get(raw, cm.atc ?? null)) ?? 0),
    ic: Math.round(parseNumber(get(raw, cm.ic ?? null)) ?? 0),
    platform: nullIfEmpty(get(raw, cm.platform ?? null)),
    placement: nullIfEmpty(get(raw, cm.placement ?? null)),
    age_range: nullIfEmpty(get(raw, cm.age_range ?? null)),
    gender: nullIfEmpty(get(raw, cm.gender ?? null)),
    region: nullIfEmpty(get(raw, cm.region ?? null)),
    device: nullIfEmpty(get(raw, cm.device ?? null)),
  };
}

function nullIfEmpty(s: string | undefined): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Parse a number string with locale tolerance.
 *
 * Strategy:
 *   - Strip currency symbols and whitespace first.
 *   - If the string contains BOTH "." and ",", the LAST one is the decimal.
 *   - If it contains only commas: exactly one with 1–2 digits after → EU
 *     decimal; otherwise → US thousands separator.
 *   - If it contains only dots: exactly one with 1–2 digits after → decimal;
 *     otherwise → EU thousands separator (e.g. "1.234.567").
 *
 * Returns null for blanks / "-" / "N/A".
 */
export function parseNumber(s: string | undefined | null): number | null {
  if (s === undefined || s === null) return null;
  const trimmed = String(s).trim();
  if (trimmed === "" || trimmed === "-" || trimmed.toLowerCase() === "n/a") return null;

  // Strip common currency symbols & non-numeric chrome, keep . , - digits.
  const cleaned = trimmed.replace(/[^\d.,\-]/g, "");

  const commaCount = (cleaned.match(/,/g) ?? []).length;
  const dotCount = (cleaned.match(/\./g) ?? []).length;
  let normalized = cleaned;

  if (commaCount > 0 && dotCount > 0) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (commaCount > 0 && dotCount === 0) {
    const afterLastComma = cleaned.length - cleaned.lastIndexOf(",") - 1;
    if (commaCount === 1 && afterLastComma >= 1 && afterLastComma <= 2) {
      // "1234,56" → EU decimal
      normalized = cleaned.replace(",", ".");
    } else {
      // "1,234" or "1,234,567" → US thousands
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (dotCount > 0 && commaCount === 0) {
    const afterLastDot = cleaned.length - cleaned.lastIndexOf(".") - 1;
    if (dotCount === 1 && afterLastDot >= 1 && afterLastDot <= 2) {
      // "1234.56" → US decimal (already correct)
      normalized = cleaned;
    } else {
      // "1.234" ambiguous — treat as EU thousands; "1.234.567" → 1234567
      normalized = cleaned.replace(/\./g, "");
    }
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function toIsoDate(s: string | undefined | null): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (trimmed === "") return null;

  // YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }

  // DD/MM/YYYY or D/M/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{4})$/);
  if (slashMatch) {
    const [, d, m, y] = slashMatch;
    return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }

  // Fallback: let Date parse it.
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  const y = parsed.getUTCFullYear();
  const m = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const d = String(parsed.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
