import { calculateBrandThresholds } from "../thresholds";
import type { BrandEconomicsInput } from "../types";

/**
 * Cronus validation inputs — PRD §5.2 & §13.
 *
 * ⚠️ NOTE on PRD internal inconsistency:
 * The PRD formula in §5.2 applied to these inputs produces:
 *   - cac_target_usd ≈ 33.08
 *   - test_threshold_usd ≈ 66.15
 *   - cac_breakeven_usd ≈ 47.63
 * But §13 says the expected outputs are 28.48 / 56.96 / 58.07.
 * Those "expected" numbers cannot be derived from the stated inputs with
 * the §5.2 formula (I worked backwards — there's no single missing term
 * that reconciles all three). We trust the formula (it matches the
 * business logic Eduardo wrote) and document the doc inconsistency for
 * the user to resolve in a v1.1 PRD update.
 *
 * If the user confirms that §13 numbers are authoritative, we'll need
 * to change the formula (likely: additional cost term ~7% of AOV or
 * higher margin %). Until then, this suite validates internal
 * consistency of the formula with the stated inputs.
 */
const CRONUS: BrandEconomicsInput = {
  aov_mxn: 1157.31,
  cogs_per_order_mxn: 141,
  shipping_mxn: 125,
  shopify_fee_mxn: 11.57,
  payment_fee_mxn: 46.29,
  target_margin_pct: 0.22,
  min_roas: 2.0,
  pieces_per_order: 1,
  exchange_rate: 17.5,
};

describe("calculateBrandThresholds (Cronus inputs, formula §5.2)", () => {
  const out = calculateBrandThresholds(CRONUS);

  it("cac_target_usd matches formula-derived value (~33.08)", () => {
    // (AOV - ops - margin) / TC
    // = (1157.31 - 323.86 - 254.6082) / 17.5
    // = 578.8418 / 17.5
    // = 33.07667...
    expect(out.cac_target_usd).toBeCloseTo(33.0767, 3);
  });

  it("test_threshold_usd = 2 × CAC target", () => {
    expect(out.test_threshold_usd).toBeCloseTo(out.cac_target_usd * 2, 6);
    expect(out.test_threshold_usd).toBeCloseTo(66.1533, 3);
  });

  it("cac_breakeven_usd = (AOV - ops) / TC (~47.63)", () => {
    // (1157.31 - 323.86) / 17.5 = 833.45 / 17.5 = 47.62571...
    expect(out.cac_breakeven_usd).toBeCloseTo(47.6257, 3);
  });

  it("margin_per_order_mxn equals AOV × target_margin_pct", () => {
    expect(out.margin_per_order_mxn).toBeCloseTo(
      CRONUS.aov_mxn * CRONUS.target_margin_pct,
      6,
    );
  });

  it("total_cost_per_order_mxn = ops + cac_target_mxn", () => {
    const ops =
      CRONUS.cogs_per_order_mxn +
      CRONUS.shipping_mxn +
      CRONUS.shopify_fee_mxn +
      CRONUS.payment_fee_mxn;
    const cac_target_mxn = out.cac_target_usd * CRONUS.exchange_rate;
    expect(out.total_cost_per_order_mxn).toBeCloseTo(ops + cac_target_mxn, 2);
  });

  it("aov_usd = aov_mxn / exchange_rate", () => {
    expect(out.aov_usd).toBeCloseTo(CRONUS.aov_mxn / CRONUS.exchange_rate, 6);
  });

  it("min_roas is passed through unchanged", () => {
    expect(out.min_roas).toBe(CRONUS.min_roas);
  });

  it("cac_target < cac_breakeven (sanity: margin squeezes room)", () => {
    expect(out.cac_target_usd).toBeLessThan(out.cac_breakeven_usd);
  });
});

describe("calculateBrandThresholds input validation", () => {
  it("rejects non-finite numbers", () => {
    expect(() =>
      calculateBrandThresholds({ ...CRONUS, aov_mxn: Number.NaN }),
    ).toThrow();
    expect(() =>
      calculateBrandThresholds({ ...CRONUS, exchange_rate: Infinity }),
    ).toThrow();
  });

  it("rejects zero AOV", () => {
    expect(() => calculateBrandThresholds({ ...CRONUS, aov_mxn: 0 })).toThrow();
  });

  it("rejects zero or negative exchange rate", () => {
    expect(() =>
      calculateBrandThresholds({ ...CRONUS, exchange_rate: 0 }),
    ).toThrow();
    expect(() =>
      calculateBrandThresholds({ ...CRONUS, exchange_rate: -1 }),
    ).toThrow();
  });

  it("rejects margin >= 1 or < 0", () => {
    expect(() =>
      calculateBrandThresholds({ ...CRONUS, target_margin_pct: 1 }),
    ).toThrow();
    expect(() =>
      calculateBrandThresholds({ ...CRONUS, target_margin_pct: -0.1 }),
    ).toThrow();
  });

  it("rejects unit economics that leave no room for ads", () => {
    expect(() =>
      calculateBrandThresholds({
        ...CRONUS,
        cogs_per_order_mxn: 900,
        shipping_mxn: 200,
        shopify_fee_mxn: 20,
        payment_fee_mxn: 40,
      }),
    ).toThrow();
  });

  it("rejects pieces_per_order < 1", () => {
    expect(() =>
      calculateBrandThresholds({ ...CRONUS, pieces_per_order: 0 }),
    ).toThrow();
  });

  it("rejects non-positive min_roas", () => {
    expect(() =>
      calculateBrandThresholds({ ...CRONUS, min_roas: 0 }),
    ).toThrow();
  });
});
