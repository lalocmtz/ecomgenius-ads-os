/**
 * Unified recommendations generator — implements §5.5 of the PRD.
 *
 * Converts raw ad/adset classifications into actionable recommendations.
 * Pure functions, no I/O.
 */

import { classifyAd } from "./ad-classifier";
import { classifyAdset } from "./adset-classifier";
import type {
  AdPerformance,
  AdRecommendation,
  AdRecommendationAction,
  AdsetPerformance,
  AdsetRecommendationOutput,
  BrandThresholds,
} from "./types";

export interface AdInput {
  ad_id: string;
  perf: AdPerformance;
  killed_history?: boolean;
}

export interface AdsetInput {
  adset_id: string;
  perf: AdsetPerformance;
}

export interface BuildRecommendationsInput {
  thresholds: BrandThresholds;
  ads: AdInput[];
  adsets: AdsetInput[];
  account_roas: number;
}

export interface BuildRecommendationsOutput {
  ads: AdRecommendation[];
  adsets: AdsetRecommendationOutput[];
}

/**
 * Map an ad verdict (+ burning flag) to a concrete action.
 *
 * kill     — LOSER tested.
 * rotate   — WINNER with burning frequency (>2.5) → replace.
 * iterate  — WINNER stable (not burning) → ship variants.
 * keep     — BORDERLINE / still running. Watch for another week.
 * let_run  — PROMISING or INCONCLUSO, more spend needed.
 */
export function adActionFromClassification(
  verdict: AdRecommendation["verdict"],
  burning: boolean,
): AdRecommendationAction {
  switch (verdict) {
    case "LOSER":
    case "KILLED":
      return "kill";
    case "WINNER":
      return burning ? "rotate" : "iterate";
    case "BORDERLINE":
      return "keep";
    case "PROMISING":
    case "INCONCLUSO":
      return "let_run";
    default: {
      // Exhaustiveness guard
      const _exhaustive: never = verdict;
      return _exhaustive;
    }
  }
}

export function buildRecommendations(
  input: BuildRecommendationsInput,
): BuildRecommendationsOutput {
  const ads: AdRecommendation[] = input.ads.map((a) => {
    const cls = classifyAd(a.perf, input.thresholds, a.killed_history);
    const action = adActionFromClassification(cls.verdict, cls.burning);
    return {
      ad_id: a.ad_id,
      action,
      reason: cls.reason,
      verdict: cls.verdict,
      metrics: {
        spend_usd: a.perf.spend_usd,
        revenue_usd: a.perf.revenue_usd,
        roas: cls.roas,
        purchases: a.perf.purchases,
        frequency: a.perf.frequency ?? null,
      },
    };
  });

  const adsets: AdsetRecommendationOutput[] = input.adsets.map((s) => {
    const rec = classifyAdset(s.perf, input.thresholds, input.account_roas);
    return {
      adset_id: s.adset_id,
      action: rec.action,
      budget_change_pct: rec.budget_change_pct,
      reason: rec.reason,
      metrics: {
        spend_usd: s.perf.total_spend_usd,
        revenue_usd: s.perf.total_revenue_usd,
        roas: rec.roas,
        purchases: s.perf.total_purchases,
      },
    };
  });

  return { ads, adsets };
}
