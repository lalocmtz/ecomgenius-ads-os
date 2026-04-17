import { buildRecommendations, adActionFromClassification } from "../recommendations";
import { calculateBrandThresholds } from "../thresholds";
import type { BrandEconomicsInput } from "../types";

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

describe("adActionFromClassification (PRD §5.5 action mapping)", () => {
  it.each([
    ["LOSER", false, "kill"],
    ["KILLED", false, "kill"],
    ["WINNER", false, "iterate"],
    ["WINNER", true, "rotate"],
    ["BORDERLINE", false, "keep"],
    ["PROMISING", false, "let_run"],
    ["INCONCLUSO", false, "let_run"],
  ] as const)("verdict=%s burning=%s → action=%s", (v, b, expected) => {
    expect(adActionFromClassification(v, b)).toBe(expected);
  });
});

describe("buildRecommendations integration", () => {
  it("produces an ad + adset recommendation object shape expected by the UI", () => {
    const out = buildRecommendations({
      thresholds: T,
      account_roas: 2.2,
      ads: [
        {
          ad_id: "ad_winner",
          perf: {
            spend_usd: 80,
            revenue_usd: 240,
            purchases: 3,
            frequency: 1.8,
            days_with_data: 5,
            days_with_roas_above_min: 5,
          },
        },
        {
          ad_id: "ad_loser",
          perf: {
            spend_usd: 70,
            revenue_usd: 0,
            purchases: 0,
            frequency: 1.2,
            days_with_data: 4,
            days_with_roas_above_min: 0,
          },
        },
        {
          ad_id: "ad_killed_memory",
          perf: {
            spend_usd: 200,
            revenue_usd: 600,
            purchases: 10,
            frequency: 1.2,
            days_with_data: 10,
            days_with_roas_above_min: 10,
          },
          killed_history: true,
        },
      ],
      adsets: [
        {
          adset_id: "adset_scale",
          perf: {
            total_spend_usd: 500,
            total_revenue_usd: 1100,
            total_purchases: 12,
            days_with_data: 7,
            days_with_roas_above_min: 5,
            active_ads_count: 3,
          },
        },
      ],
    });

    expect(out.ads).toHaveLength(3);
    expect(out.adsets).toHaveLength(1);

    const winner = out.ads.find((a) => a.ad_id === "ad_winner")!;
    expect(winner.action).toBe("iterate");
    expect(winner.verdict).toBe("WINNER");

    const loser = out.ads.find((a) => a.ad_id === "ad_loser")!;
    expect(loser.action).toBe("kill");
    expect(loser.verdict).toBe("LOSER");

    const ghost = out.ads.find((a) => a.ad_id === "ad_killed_memory")!;
    expect(ghost.verdict).toBe("KILLED");
    expect(ghost.action).toBe("kill");

    const adset = out.adsets[0]!;
    expect(adset.action).toBe("SCALE_UP");
    expect(adset.budget_change_pct).toBe(25);
  });

  it("burning winner becomes rotate instead of iterate", () => {
    const out = buildRecommendations({
      thresholds: T,
      account_roas: 2.2,
      ads: [
        {
          ad_id: "ad_burning",
          perf: {
            spend_usd: 120,
            revenue_usd: 360,
            purchases: 4,
            frequency: 3.1,
            days_with_data: 6,
            days_with_roas_above_min: 5,
          },
        },
      ],
      adsets: [],
    });
    expect(out.ads[0]!.action).toBe("rotate");
  });
});
