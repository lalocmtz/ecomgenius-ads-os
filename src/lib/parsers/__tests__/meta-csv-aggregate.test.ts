import { isAggregateMetaCsv, parseMetaAggregateCsv } from "../meta-csv-aggregate";

const AGGREGATE_CSV = `"Inicio del informe","Fin del informe","Nombre del anuncio","Entrega del anuncio","Último cambio significativo","Importe gastado (MXN)","Valor de resultados","Indicador de ROAS de resultado","Costo por resultados","Indicador de resultado",Compras,"ROAS de resultados","CTR (todos)","Reproducciones de video de 3 segundos","Reproducciones de video hasta el 100%","Artículos agregados al carrito","Información de pago agregada"
2026-03-17,2026-04-15,"PACK 3 -D.jpg",active,2026-04-01T09:14:34-0600,50.6,,,,,,,0.572519,,,5,
2026-03-17,2026-04-15,"PACK 3 - A.jpg",active,2026-04-01T09:14:34-0600,1350.5,7833.4,action_values:offsite_conversion.fb_pixel_purchase,168.8125,actions:offsite_conversion.fb_pixel_purchase,8,5.80037023,0.947226,343,172,61,8
2026-03-17,2026-04-15,"PACK 3 -E.jpg",inactive,2026-04-01T09:14:34-0600,772.37,677,action_values:offsite_conversion.fb_pixel_purchase,772.37,actions:offsite_conversion.fb_pixel_purchase,1,0.87652291,0.946278,25,15,26,2
`;

const DAILY_CSV = `Día,Nombre del anuncio,Identificador del anuncio,Nombre del conjunto de anuncios,Identificador del conjunto,Importe gastado (USD),Compras
2026-04-10,AD1,111,Conj,70001,20,1
`;

describe("isAggregateMetaCsv", () => {
  it("detects the aggregate format", () => {
    expect(isAggregateMetaCsv(AGGREGATE_CSV)).toBe(true);
  });

  it("rejects daily-breakdown CSVs", () => {
    expect(isAggregateMetaCsv(DAILY_CSV)).toBe(false);
  });
});

describe("parseMetaAggregateCsv", () => {
  it("parses a Feel Ink aggregate export with MXN currency", () => {
    const r = parseMetaAggregateCsv(AGGREGATE_CSV, { exchange_rate: 17.5, min_roas: 2 });
    expect(r.rows).toHaveLength(3);
    expect(r.currencyDetected).toBe("MXN");
    expect(r.exchangeRateApplied).toBe(17.5);

    const packA = r.rows.find((x) => x.ad_name === "PACK 3 - A.jpg")!;
    // Spend 1350.5 MXN / 17.5 = 77.17 USD (±0.01)
    expect(packA.spend_usd).toBeCloseTo(77.17, 1);
    // Revenue 7833.4 / 17.5 = 447.62 USD
    expect(packA.revenue_usd).toBeCloseTo(447.62, 1);
    expect(packA.purchases).toBe(8);
  });

  it("synthesizes stable ad IDs from names when missing", () => {
    const r = parseMetaAggregateCsv(AGGREGATE_CSV, { exchange_rate: 17.5, min_roas: 2 });
    const ids = r.rows.map((x) => x.ad_external_id);
    // All look like synthesized IDs.
    ids.forEach((id) => expect(id).toMatch(/^ad_[a-z0-9]+$/));
    // Running twice produces identical IDs (stable hash).
    const r2 = parseMetaAggregateCsv(AGGREGATE_CSV, { exchange_rate: 17.5, min_roas: 2 });
    expect(r2.rows.map((x) => x.ad_external_id)).toEqual(ids);
  });

  it("uses 'aggregate-default' adset for all ads when adset columns missing", () => {
    const r = parseMetaAggregateCsv(AGGREGATE_CSV, { exchange_rate: 17.5, min_roas: 2 });
    const adsets = new Set(r.rows.map((x) => x.adset_external_id));
    expect(adsets.size).toBe(1);
    expect(adsets.has("aggregate-default")).toBe(true);
  });

  it("uses the period_end as the date", () => {
    const r = parseMetaAggregateCsv(AGGREGATE_CSV, { exchange_rate: 17.5, min_roas: 2 });
    r.rows.forEach((row) => expect(row.date).toBe("2026-04-15"));
    expect(r.dateRange).toEqual({ start: "2026-04-15", end: "2026-04-15" });
    // periodDays reflects the informe span
    expect(r.periodDays).toBeGreaterThanOrEqual(1);
  });

  it("rejects CSVs missing report start/end", () => {
    const bad = `"Nombre del anuncio","Importe gastado (MXN)"\n"AD1",100\n`;
    expect(() =>
      parseMetaAggregateCsv(bad, { exchange_rate: 17.5, min_roas: 2 }),
    ).toThrow(/Inicio del informe/);
  });
});
