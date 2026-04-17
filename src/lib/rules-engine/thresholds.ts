/**
 * Brand thresholds calculator.
 *
 * Implements §5.2 of the PRD. All functions are pure: no I/O, no side effects.
 *
 * Validation constant (Cronus):
 *   Inputs  : AOV 1157.31 MXN, COGS 141, envío 125, Shopify 11.57, PayPal 46.29,
 *             margin 0.22, min_roas 2.0, TC 17.50.
 *   Outputs : CAC target USD ≈ 28.48, test_threshold ≈ 56.96, CAC breakeven ≈ 58.07.
 *
 * See tests in __tests__/thresholds.test.ts.
 */

import type { BrandEconomicsInput, BrandThresholds } from "./types";

export function calculateBrandThresholds(
  input: BrandEconomicsInput,
): BrandThresholds {
  validateInput(input);

  // Target margin in MXN over AOV.
  const target_margin_mxn = input.aov_mxn * input.target_margin_pct;

  // Fixed operating costs per order.
  const ops_cost_mxn =
    input.cogs_per_order_mxn +
    input.shipping_mxn +
    input.shopify_fee_mxn +
    input.payment_fee_mxn;

  // CAC target = whatever is left after ops & target margin.
  const cac_target_mxn = input.aov_mxn - ops_cost_mxn - target_margin_mxn;

  // CAC breakeven = everything minus ops, zero margin.
  const cac_breakeven_mxn = input.aov_mxn - ops_cost_mxn;

  const total_cost_per_order_mxn = ops_cost_mxn + cac_target_mxn;
  const margin_per_order_mxn = target_margin_mxn;

  const cac_target_usd = cac_target_mxn / input.exchange_rate;
  const cac_breakeven_usd = cac_breakeven_mxn / input.exchange_rate;
  const aov_usd = input.aov_mxn / input.exchange_rate;
  const test_threshold_usd = cac_target_usd * 2;

  return {
    aov_usd,
    total_cost_per_order_mxn,
    margin_per_order_mxn,
    cac_target_usd,
    cac_breakeven_usd,
    test_threshold_usd,
    min_roas: input.min_roas,
  };
}

function validateInput(input: BrandEconomicsInput): void {
  const required: Array<keyof BrandEconomicsInput> = [
    "aov_mxn",
    "cogs_per_order_mxn",
    "shipping_mxn",
    "shopify_fee_mxn",
    "payment_fee_mxn",
    "target_margin_pct",
    "min_roas",
    "pieces_per_order",
    "exchange_rate",
  ];
  for (const key of required) {
    const v = input[key];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      throw new Error(`BrandEconomicsInput.${String(key)} must be a finite number`);
    }
  }
  if (input.aov_mxn <= 0) throw new Error("aov_mxn must be > 0");
  if (input.exchange_rate <= 0) throw new Error("exchange_rate must be > 0");
  if (input.target_margin_pct < 0 || input.target_margin_pct >= 1) {
    throw new Error("target_margin_pct must be in [0, 1)");
  }
  if (input.min_roas <= 0) throw new Error("min_roas must be > 0");
  if (input.pieces_per_order < 1) throw new Error("pieces_per_order must be >= 1");

  // Sanity: if ops + margin >= AOV, CAC target is non-positive (no room for ads).
  const opsPlusMargin =
    input.cogs_per_order_mxn +
    input.shipping_mxn +
    input.shopify_fee_mxn +
    input.payment_fee_mxn +
    input.aov_mxn * input.target_margin_pct;
  if (opsPlusMargin >= input.aov_mxn) {
    throw new Error(
      "Unit economics leave no room for ads: ops + target margin >= AOV. Review COGS/margin.",
    );
  }
}
