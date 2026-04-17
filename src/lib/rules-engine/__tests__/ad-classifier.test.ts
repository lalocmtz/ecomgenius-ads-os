import { classifyAd } from "../ad-classifier";
import { calculateBrandThresholds } from "../thresholds";
import type { AdPerformance, BrandEconomicsInput } from "../types";

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

const T = calculateBrandThresholds(CRONUS);

function perf(overrides: Partial<AdPerformance> = {}): AdPerformance {
  return {
    spend_usd: 0,
    purchases: 0,
    revenue_usd: 0,
    frequency: 1.0,
    days_with_data: 1,
    days_with_roas_above_min: 0,
    ...overrides,
  };
}

describe("classifyAd (PRD §5.3 + §13 fixtures)", () => {
  // --- PRD §13 fixtures ---

  it("SK28_C → WINNER (tested, ROAS ≥ 2)", () => {
    const result = classifyAd(
      perf({ spend_usd: 80, revenue_usd: 240, purchases: 3, frequency: 1.8 }),
      T,
    );
    expect(result.verdict).toBe("WINNER");
    expect(result.burning).toBe(false);
    expect(result.roas).toBeCloseTo(3.0, 2);
  });

  it("12_C → LOSER (tested, zero purchases)", () => {
    const result = classifyAd(
      perf({ spend_usd: 70, purchases: 0, revenue_usd: 0 }),
      T,
    );
    expect(result.verdict).toBe("LOSER");
    expect(result.reason).toContain("sin compras");
  });

  it("12_C re-upload with killed_history → KILLED", () => {
    const result = classifyAd(
      perf({ spend_usd: 1000, purchases: 50, revenue_usd: 5000 }),
      T,
      true,
    );
    expect(result.verdict).toBe("KILLED");
    expect(result.reason).toContain("Previamente descartado");
  });

  it("ADS-SK-003 → PROMISING (not yet tested but ROAS strong)", () => {
    // spend < test_threshold (~57), but ROAS ≥ 2 with purchases
    const result = classifyAd(
      perf({ spend_usd: 30, purchases: 2, revenue_usd: 80 }),
      T,
    );
    expect(result.verdict).toBe("PROMISING");
    expect(result.needs_test_spend).toBeGreaterThan(0);
  });

  it("HOOK 3 at $60.91 → INCONCLUSO under formula-derived threshold (~66.15)", () => {
    // PRD §13 says LOSER, but that assumes the §13 test_threshold of 56.96
    // which the §5.2 formula does not actually produce from the stated inputs.
    // Under the §5.2 formula, $60.91 < $66.15 so the ad is not yet tested.
    // Flag this in the README as a PRD inconsistency to resolve in v1.1.
    const result = classifyAd(
      perf({ spend_usd: 60.91, purchases: 0, revenue_usd: 0 }),
      T,
    );
    expect(result.verdict).toBe("INCONCLUSO");
  });

  it("HOOK 3 at $70 (past threshold) with zero purchases → LOSER", () => {
    const result = classifyAd(
      perf({ spend_usd: 70, purchases: 0, revenue_usd: 0 }),
      T,
    );
    expect(result.verdict).toBe("LOSER");
  });

  // --- Other verdicts ---

  it("Tested + ROAS in 1.5–min_roas → BORDERLINE", () => {
    const result = classifyAd(
      perf({ spend_usd: 70, purchases: 2, revenue_usd: 112 }), // ROAS = 1.6
      T,
    );
    expect(result.verdict).toBe("BORDERLINE");
  });

  it("Tested + ROAS < 1.5 → LOSER (explicit)", () => {
    const result = classifyAd(
      perf({ spend_usd: 70, purchases: 1, revenue_usd: 80 }), // ROAS ≈ 1.14
      T,
    );
    expect(result.verdict).toBe("LOSER");
    expect(result.reason).toContain("<1.5x");
  });

  it("Not tested + zero purchases → INCONCLUSO", () => {
    const result = classifyAd(
      perf({ spend_usd: 10, purchases: 0, revenue_usd: 0 }),
      T,
    );
    expect(result.verdict).toBe("INCONCLUSO");
    expect(result.needs_test_spend).toBeGreaterThan(0);
  });

  it("Not tested + purchases with ROAS < min → INCONCLUSO", () => {
    const result = classifyAd(
      perf({ spend_usd: 20, purchases: 1, revenue_usd: 30 }),
      T,
    );
    expect(result.verdict).toBe("INCONCLUSO");
  });

  // --- Burning flag ---

  it("Burning flag set when frequency > 2.5", () => {
    const result = classifyAd(
      perf({
        spend_usd: 80,
        revenue_usd: 240,
        purchases: 3,
        frequency: 2.6,
      }),
      T,
    );
    expect(result.verdict).toBe("WINNER");
    expect(result.burning).toBe(true);
    expect(result.reason).toContain("frecuencia alta");
  });

  it("Burning not set when frequency exactly 2.5", () => {
    const result = classifyAd(
      perf({
        spend_usd: 80,
        revenue_usd: 240,
        purchases: 3,
        frequency: 2.5,
      }),
      T,
    );
    expect(result.burning).toBe(false);
  });

  // --- Edge cases ---

  it("zero spend → INCONCLUSO with full test_threshold needed", () => {
    const result = classifyAd(perf({ spend_usd: 0 }), T);
    expect(result.verdict).toBe("INCONCLUSO");
    expect(result.needs_test_spend).toBeCloseTo(T.test_threshold_usd, 2);
  });

  it("roas is 0 when spend is 0", () => {
    const result = classifyAd(perf({ spend_usd: 0 }), T);
    expect(result.roas).toBe(0);
  });

  it("missing frequency is treated as 0 (not burning)", () => {
    const result = classifyAd(
      perf({
        spend_usd: 80,
        revenue_usd: 240,
        purchases: 3,
        frequency: undefined,
      }),
      T,
    );
    expect(result.burning).toBe(false);
  });
});
