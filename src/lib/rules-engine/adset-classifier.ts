/**
 * Adset classifier — implements §5.4 of the PRD.
 *
 * Pure function: no I/O, no side effects.
 */

import type {
  AdsetPerformance,
  AdsetRecommendation,
  BrandThresholds,
} from "./types";

/** Minimum spend in USD before a bad adset gets fully paused. */
export const PAUSE_SPEND_FLOOR_USD = 200;

/** Minimum consecutive days at/above min_roas before scaling up (SOP). */
export const SUSTAINED_DAYS_TO_SCALE = 5;

/** SOP-safe scale up percentage. 30% is the ceiling per SOP. */
export const SCALE_UP_PCT = 25;

/** Bottom of BORDERLINE band (shared conceptually with ad classifier). */
export const ADSET_BORDERLINE_ROAS_FLOOR = 1.5;

export function classifyAdset(
  perf: AdsetPerformance,
  thresholds: BrandThresholds,
  account_roas: number,
): AdsetRecommendation {
  const roas =
    perf.total_spend_usd > 0 ? perf.total_revenue_usd / perf.total_spend_usd : 0;

  const account_blocked = account_roas < thresholds.min_roas;

  // Deep underperformer with meaningful spend → pause whole adset.
  if (roas < ADSET_BORDERLINE_ROAS_FLOOR && perf.total_spend_usd > PAUSE_SPEND_FLOOR_USD) {
    return {
      action: "PAUSE",
      budget_change_pct: -100,
      reason: `ROAS ${roas.toFixed(2)}x con $${perf.total_spend_usd.toFixed(2)} gastados. Pausar conjunto completo.`,
      roas,
    };
  }

  // Borderline → rotate creatives inside the adset, do not scale.
  if (roas >= ADSET_BORDERLINE_ROAS_FLOOR && roas < thresholds.min_roas) {
    return {
      action: "TEST_NEW_CREATIVES",
      budget_change_pct: 0,
      reason: `ROAS ${roas.toFixed(2)}x. No escalar. Testear creativos nuevos dentro del conjunto.`,
      roas,
    };
  }

  // Winner adset
  if (roas >= thresholds.min_roas) {
    const sustained = perf.days_with_roas_above_min >= SUSTAINED_DAYS_TO_SCALE;

    if (account_blocked) {
      return {
        action: "HOLD",
        budget_change_pct: 0,
        reason: `ROAS cuenta ${account_roas.toFixed(2)}x bajo mínimo. Pausar escalamiento hasta recuperar.`,
        roas,
      };
    }

    if (!sustained) {
      return {
        action: "HOLD",
        budget_change_pct: 0,
        reason: `ROAS ${roas.toFixed(2)}x pero solo ${perf.days_with_roas_above_min}/${SUSTAINED_DAYS_TO_SCALE} días sostenidos. Esperar.`,
        roas,
      };
    }

    return {
      action: "SCALE_UP",
      budget_change_pct: SCALE_UP_PCT,
      reason: `ROAS ${roas.toFixed(2)}x sostenido ${perf.days_with_roas_above_min} días. Escalar +${SCALE_UP_PCT}%.`,
      roas,
    };
  }

  // Default
  return {
    action: "HOLD",
    budget_change_pct: 0,
    reason: `ROAS ${roas.toFixed(2)}x. Mantener y vigilar.`,
    roas,
  };
}
