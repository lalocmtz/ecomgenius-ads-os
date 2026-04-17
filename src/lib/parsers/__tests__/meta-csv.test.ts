import { parseMetaCsv, parseNumber, toIsoDate, normalizeHeader } from "../meta-csv";

describe("parseNumber", () => {
  it.each([
    ["", null],
    ["-", null],
    ["N/A", null],
    ["1234", 1234],
    ["1,234", 1234],
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["1234.56", 1234.56],
    ["1234,56", 1234.56],
    ["$1,234.56", 1234.56],
    ["1.234.567", 1234567],
    ["-12.5", -12.5],
  ])("parses %s → %p", (input, expected) => {
    expect(parseNumber(input)).toBe(expected);
  });
});

describe("toIsoDate", () => {
  it("accepts YYYY-MM-DD", () => {
    expect(toIsoDate("2026-04-16")).toBe("2026-04-16");
  });
  it("zero-pads single-digit months/days", () => {
    expect(toIsoDate("2026-4-7")).toBe("2026-04-07");
  });
  it("accepts DD/MM/YYYY", () => {
    expect(toIsoDate("16/04/2026")).toBe("2026-04-16");
  });
  it("returns null on empty", () => {
    expect(toIsoDate("")).toBeNull();
    expect(toIsoDate(undefined)).toBeNull();
  });
});

describe("normalizeHeader", () => {
  it("lowercases and strips accents", () => {
    expect(normalizeHeader("Día")).toBe("dia");
    expect(normalizeHeader("Plataforma de Dispositivos")).toBe(
      "plataforma de dispositivos",
    );
  });
});

const BASIC_CSV = `Día,Nombre del anuncio,Identificador del anuncio,Nombre del conjunto de anuncios,Identificador del conjunto,Nombre de la campaña,Importe gastado (USD),Compras,Valor de conversión de compras,Impresiones,Clics,CTR,CPC,CPM,Frecuencia,Pagos iniciados,Artículos agregados al carrito
2026-04-10,SK28_C,123456,Conjunto A,70001,Campaña 1,40,2,120,1000,50,5.0,0.8,40.0,1.5,5,8
2026-04-11,SK28_C,123456,Conjunto A,70001,Campaña 1,40,1,120,1100,60,5.5,0.67,36.36,1.6,3,6
2026-04-10,HOOK 3,789012,Conjunto B,70002,Campaña 1,30.91,0,0,800,20,2.5,1.55,38.64,1.8,2,4
2026-04-11,HOOK 3,789012,Conjunto B,70002,Campaña 1,30.00,0,0,900,18,2.0,1.67,33.33,2.0,1,3
`;

describe("parseMetaCsv", () => {
  it("parses a well-formed Meta CSV", () => {
    const result = parseMetaCsv(BASIC_CSV);
    expect(result.rows).toHaveLength(4);
    expect(result.rowsFailed).toBe(0);
    expect(result.dateRange).toEqual({ start: "2026-04-10", end: "2026-04-11" });
    const first = result.rows[0]!;
    expect(first.ad_name).toBe("SK28_C");
    expect(first.spend_usd).toBe(40);
    expect(first.revenue_usd).toBe(120);
    expect(first.purchases).toBe(2);
    expect(first.adset_external_id).toBe("70001");
  });

  it("tolerates a BOM", () => {
    const csv = "\uFEFF" + BASIC_CSV;
    expect(parseMetaCsv(csv).rows).toHaveLength(4);
  });

  it("throws when Día column is missing", () => {
    const csv = BASIC_CSV.replace(/^Día/m, "NoDate");
    expect(() => parseMetaCsv(csv)).toThrow(/Día/);
  });

  it("throws when ad id column is missing (and synth disabled)", () => {
    const csv = BASIC_CSV.replace(
      "Identificador del anuncio,",
      "SomethingElse,",
    );
    expect(() => parseMetaCsv(csv)).toThrow(/anuncio/i);
  });

  it("skips aggregated/total rows without a valid date", () => {
    const csvWithTotal = BASIC_CSV + `"Total de cuenta",,,,,,140,3,240,3800,148,,,,,,\n`;
    const result = parseMetaCsv(csvWithTotal);
    expect(result.rows).toHaveLength(4);
  });

  it("accepts breakdowns and reports their presence", () => {
    const csv = `Día,Nombre del anuncio,Identificador del anuncio,Nombre del conjunto de anuncios,Identificador del conjunto,Importe gastado (USD),Compras,Valor de conversión de compras,Impresiones,Clics,Edad,Sexo
2026-04-10,AD1,111,Conj,70001,20,1,60,500,20,18-24,female
2026-04-10,AD1,111,Conj,70001,25,1,60,520,22,25-34,male
`;
    const result = parseMetaCsv(csv);
    expect(result.rows).toHaveLength(2);
    expect(result.hasBreakdowns.age).toBe(true);
    expect(result.hasBreakdowns.gender).toBe(true);
    expect(result.hasBreakdowns.platform).toBe(false);
    expect(result.rows[0]!.age_range).toBe("18-24");
    expect(result.rows[1]!.gender).toBe("male");
  });

  it("records failures without blowing up the whole parse", () => {
    const csv = `Día,Nombre del anuncio,Identificador del anuncio,Nombre del conjunto de anuncios,Identificador del conjunto,Importe gastado (USD)
2026-04-10,AD1,111,Conj,70001,20
2026-04-10,AD2,112,Conj,70001,no-es-numero
`;
    const result = parseMetaCsv(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rowsFailed).toBe(1);
    expect(result.failures[0]!.reason).toMatch(/Spend/);
  });
});
