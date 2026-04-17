import { classifyAdset } from "../adset-classifier";
import { calculateBrandThresholds } from "../thresholds";
import type { AdsetPerformance, BrandEconomicsInput } from "../types";

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

function perf(overrides: Partial<AdsetPerformance> = {}): AdsetPerformance {
  return {
    total_spend_usd: 0,
    total_revenue_usd: 0,
    total_purchases: 0,
    days_with_data: 7,
    days_with_roas_above_min: 0,
    active_ads_count: 3,
    ...overrides,
  };
}

describe("classifyAdset (PRD §5.4)", () => {
  it("ROAS < 1.5 with significant spend (>$200) → PAUSE", () => {
    const r = classifyAdset(
      perf({
        total_spend_usd: 250,
        total_revenue_usd: 200,
        total_purchases: 4,
      }),
      T,
      2.0,
    );
    expect(r.action).toBe("PAUSE");
    expect(r.budget_change_pct).toBe(-100);
  });

  it("ROAS < 1.5 with low spend (≤$200) does NOT pause", () => {
    const r = classifyAdset(
      perf({
        total_spend_usd: 100,
        total_revenue_usd: 80,
        total_purchases: 1,
      }),
      T,
      2.0,
    );
    expect(r.action).not.toBe("PAUSE");
  });

  it("ROAS in [1.5, min_roas) → TEST_NEW_CREATIVES", () => {
    const r = classifyAdset(
      perf({
        total_spend_usd: 300,
        total_revenue_usd: 525, // 1.75x
        total_purchases: 5,
      }),
      T,
      2.0,
    );
    expect(r.action).toBe("TEST_NEW_CREATIVES");
    expect(r.budget_change_pct).toBe(0);
  });

  it("ROAS ≥ min_roas + 5 days sustained + account OK → SCALE_UP +25%", () => {
    const r = classifyAdset(
      perf({
        total_spend_usd: 500,
        total_revenue_usd: 1100, // 2.2x
        total_purchases: 12,
        days_with_roas_above_min: 5,
      }),
      T,
      2.1,
    );
    expect(r.action).toBe("SCALE_UP");
    expect(r.budget_change_pct).toBe(25);
  });

  it("ROAS ≥ min_roas but < 5 sustained days → HOLD", () => {
    const r = classifyAdset(
      perf({
        total_spend_usd: 500,
        total_revenue_usd: 1100,
        total_purchases: 12,
        days_with_roas_above_min: 3,
      }),
      T,
      2.1,
    );
    expect(r.action).toBe("HOLD");
    expect(r.budget_change_pct).toBe(0);
  });

  it("account ROAS < min_roas blocks scale-up even if sustained", () => {
    const r = classifyAdset(
      perf({
        total_spend_usd: 500,
        total_revenue_usd: 1100,
        total_purchases: 12,
        days_with_roas_above_min: 7,
      }),
      T,
      1.7, // account under min
    );
    expect(r.action).toBe("HOLD");
    expect(r.reason).toContain("cuenta");
  });

  it("no performance (0 spend) → HOLD default", () => {
    const r = classifyAdset(perf({}), T, 2.0);
    expect(r.action).toBe("HOLD");
    expect(r.roas).toBe(0);
  });
});
