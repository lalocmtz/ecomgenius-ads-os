/**
 * Shared types for the rules engine.
 * Keep this file free of runtime logic.
 */

// --------- Brand economics ---------
export interface BrandEconomicsInput {
  /** AOV in business currency (MXN). */
  aov_mxn: number;
  /** COGS per order in MXN. */
  cogs_per_order_mxn: number;
  /** Shipping cost per order in MXN. */
  shipping_mxn: number;
  /** Shopify fee per order in MXN. */
  shopify_fee_mxn: number;
  /** Payment processor fee per order in MXN (PayPal/Stripe/etc). */
  payment_fee_mxn: number;
  /** Target margin as a decimal (0.22 = 22%). */
  target_margin_pct: number;
  /** Minimum ROAS floor (e.g. 2.0). */
  min_roas: number;
  /** Pieces per order (kept for reporting; not used in thresholds). */
  pieces_per_order: number;
  /** MXN per 1 USD (e.g. 17.50). */
  exchange_rate: number;
}

export interface BrandThresholds {
  aov_usd: number;
  total_cost_per_order_mxn: number;
  margin_per_order_mxn: number;
  cac_target_usd: number;
  cac_breakeven_usd: number;
  /** 2x CAC target — the spend required to declare an ad tested. */
  test_threshold_usd: number;
  min_roas: number;
}

// --------- Ad classification ---------
export type AdVerdict =
  | "WINNER"
  | "BORDERLINE"
  | "LOSER"
  | "PROMISING"
  | "INCONCLUSO"
  | "KILLED";

export interface AdPerformance {
  spend_usd: number;
  purchases: number;
  revenue_usd: number;
  frequency?: number;
  days_with_data: number;
  days_with_roas_above_min: number;
}

export interface AdClassification {
  verdict: AdVerdict;
  reason: string;
  burning: boolean;
  needs_test_spend: number;
  roas: number;
}

// --------- Adset classification ---------
export type AdsetAction =
  | "SCALE_UP"
  | "HOLD"
  | "DESCALE"
  | "PAUSE"
  | "TEST_NEW_CREATIVES";

export interface AdsetPerformance {
  total_spend_usd: number;
  total_revenue_usd: number;
  total_purchases: number;
  days_with_data: number;
  days_with_roas_above_min: number;
  active_ads_count: number;
}

export interface AdsetRecommendation {
  action: AdsetAction;
  budget_change_pct: number;
  reason: string;
  roas: number;
}

// --------- Unified recommendations ---------
export type AdRecommendationAction =
  | "kill"
  | "keep"
  | "let_run"
  | "rotate"
  | "iterate";

export interface AdRecommendation {
  ad_id: string;
  action: AdRecommendationAction;
  reason: string;
  verdict: AdVerdict;
  metrics: {
    spend_usd: number;
    revenue_usd: number;
    roas: number;
    purchases: number;
    frequency: number | null;
  };
}

export interface AdsetRecommendationOutput {
  adset_id: string;
  action: AdsetAction;
  budget_change_pct: number;
  reason: string;
  metrics: {
    spend_usd: number;
    revenue_usd: number;
    roas: number;
    purchases: number;
  };
}
