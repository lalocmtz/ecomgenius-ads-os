/**
 * Ad classifier — implements §5.3 of the PRD.
 *
 * Pure function: no I/O, no side effects.
 * Returns a verdict, reason, and burning/test flags.
 */

import type {
  AdClassification,
  AdPerformance,
  BrandThresholds,
} from "./types";

/** Frequency above this flags the ad as "burning" (needs rotation). */
export const BURNING_FREQUENCY = 2.5;

/** ROAS floor for BORDERLINE (below → LOSER). */
export const BORDERLINE_ROAS_FLOOR = 1.5;

/**
 * Classify an ad based on its performance and brand thresholds.
 *
 * @param perf          Cumulative performance for the ad.
 * @param thresholds    Calculated thresholds for the brand.
 * @param killedHistory If the ad was previously KILLED, it never comes back.
 */
export function classifyAd(
  perf: AdPerformance,
  thresholds: BrandThresholds,
  killedHistory = false,
): AdClassification {
  if (killedHistory) {
    return {
      verdict: "KILLED",
      reason: "Previamente descartado. Los KILLED nunca vuelven.",
      burning: false,
      needs_test_spend: 0,
      roas: 0,
    };
  }

  const roas = perf.spend_usd > 0 ? perf.revenue_usd / perf.spend_usd : 0;
  const tested = perf.spend_usd >= thresholds.test_threshold_usd;
  const burning = (perf.frequency ?? 0) > BURNING_FREQUENCY;
  const needs_test_spend = tested
    ? 0
    : Math.max(0, thresholds.test_threshold_usd - perf.spend_usd);

  // Tested — definitive verdict
  if (tested) {
    if (perf.purchases === 0) {
      return {
        verdict: "LOSER",
        reason: `Gastó $${perf.spend_usd.toFixed(2)} sin compras. Apagar ya.`,
        burning,
        needs_test_spend: 0,
        roas,
      };
    }
    if (roas >= thresholds.min_roas) {
      const burningNote = burning
        ? " ATENCIÓN: frecuencia alta, preparar reemplazo."
        : "";
      return {
        verdict: "WINNER",
        reason:
          `Testeado con ROAS ${roas.toFixed(2)}x (≥${thresholds.min_roas}x).` +
          burningNote,
        burning,
        needs_test_spend: 0,
        roas,
      };
    }
    if (roas >= BORDERLINE_ROAS_FLOOR) {
      return {
        verdict: "BORDERLINE",
        reason: `Testeado con ROAS ${roas.toFixed(2)}x (1.5x–${thresholds.min_roas}x). Vigilar 1 semana más.`,
        burning,
        needs_test_spend: 0,
        roas,
      };
    }
    return {
      verdict: "LOSER",
      reason: `Testeado con ROAS ${roas.toFixed(2)}x (<1.5x). Apagar.`,
      burning,
      needs_test_spend: 0,
      roas,
    };
  }

  // Not yet tested
  if (perf.purchases > 0 && roas >= thresholds.min_roas) {
    return {
      verdict: "PROMISING",
      reason:
        `Sin test completo pero señal: ROAS ${roas.toFixed(2)}x con ${perf.purchases} compras. ` +
        `Faltan $${needs_test_spend.toFixed(2)} para confirmar.`,
      burning,
      needs_test_spend,
      roas,
    };
  }

  return {
    verdict: "INCONCLUSO",
    reason: `Sin test completo ($${perf.spend_usd.toFixed(2)}/$${thresholds.test_threshold_usd.toFixed(2)}), sin señal suficiente.`,
    burning,
    needs_test_spend,
    roas,
  };
}
