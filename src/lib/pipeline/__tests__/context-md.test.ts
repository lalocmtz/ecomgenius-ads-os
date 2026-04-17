import { buildContextMd } from "../context-md";

const T = {
  aov_usd: 66.13,
  total_cost_per_order_mxn: 902.70,
  margin_per_order_mxn: 254.61,
  cac_target_usd: 33.08,
  cac_breakeven_usd: 47.63,
  test_threshold_usd: 66.15,
  min_roas: 2.0,
};

describe("buildContextMd", () => {
  it("produces a valid markdown with all sections", () => {
    const md = buildContextMd({
      brandName: "Feel Ink",
      brandSlug: "feel-ink",
      periodLabel: "Abril 2026",
      thresholds: T,
      accountSummary: {
        spend_usd: 500,
        revenue_usd: 1100,
        purchases: 20,
        roas: 2.2,
      },
      winners: [{ name: "SK28_C", roas: 3.0, spend_usd: 80, purchases: 4 }],
      losers: [
        { name: "12_C", spend_usd: 70, reason: "Zero purchases. Apagar." },
      ],
      adsetActions: [
        { name: "Conjunto A", action: "SCALE_UP", reason: "ROAS sostenido" },
      ],
      openQuestions: ["¿Cambiar hook del SK28?"],
    });

    expect(md).toContain("# Contexto Feel Ink");
    expect(md).toContain("CAC target USD: $33.08");
    expect(md).toContain("SK28_C");
    expect(md).toContain("12_C");
    expect(md).toContain("SCALE_UP");
    expect(md).toContain("¿Cambiar hook del SK28?");
  });

  it("emits account-under-min warning when ROAS < min", () => {
    const md = buildContextMd({
      brandName: "Feel Ink",
      brandSlug: "feel-ink",
      periodLabel: "Abril 2026",
      thresholds: T,
      accountSummary: {
        spend_usd: 500,
        revenue_usd: 800,
        purchases: 14,
        roas: 1.6,
      },
      winners: [],
      losers: [],
      adsetActions: [],
    });
    expect(md).toContain("ROAS cuenta bajo mínimo");
  });
});
