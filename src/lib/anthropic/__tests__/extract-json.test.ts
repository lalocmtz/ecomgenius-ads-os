import { extractJson } from "../creative-analyst";

describe("extractJson", () => {
  it("extracts from plain object", () => {
    const out = extractJson('{"hook": "hola", "x": 1}');
    expect(JSON.parse(out).hook).toBe("hola");
  });

  it("extracts from ```json fenced block", () => {
    const text = 'Here you go:\n```json\n{"hook":"a"}\n```\ndone.';
    expect(JSON.parse(extractJson(text)).hook).toBe("a");
  });

  it("extracts from ``` fenced block without language", () => {
    const text = '```\n{"hook":"a"}\n```';
    expect(JSON.parse(extractJson(text)).hook).toBe("a");
  });

  it("throws if no JSON found", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});
