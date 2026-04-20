/**
 * Date-range resolution for the dashboard filter.
 *
 * Ranges are anchored on `maxDate` (the latest date available for the brand)
 * rather than "today" — users often upload data days after the fact and the
 * dashboard should reflect the data they have, not calendar time.
 */

export type RangeKey = "HOY" | "AYER" | "3D" | "7D" | "TOTAL";

export const RANGE_KEYS: RangeKey[] = ["HOY", "AYER", "3D", "7D", "TOTAL"];

export const RANGE_LABELS: Record<RangeKey, string> = {
  HOY: "Hoy",
  AYER: "Ayer",
  "3D": "3 días",
  "7D": "7 días",
  TOTAL: "Total",
};

export function parseRange(raw: string | undefined): RangeKey {
  const v = (raw ?? "").toUpperCase() as RangeKey;
  return RANGE_KEYS.includes(v) ? v : "7D";
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function resolveRange(
  key: RangeKey,
  bounds: { min: string | null; max: string | null },
): { start: string; end: string } {
  const max = bounds.max ?? new Date().toISOString().slice(0, 10);
  const min = bounds.min ?? max;
  switch (key) {
    case "HOY":
      return { start: max, end: max };
    case "AYER": {
      const y = addDays(max, -1);
      return { start: y, end: y };
    }
    case "3D":
      return { start: addDays(max, -2), end: max };
    case "7D":
      return { start: addDays(max, -6), end: max };
    case "TOTAL":
      return { start: min, end: max };
  }
}
