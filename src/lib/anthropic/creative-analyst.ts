/**
 * Creative analyst — PRD §7.
 *
 * Takes a creative (video frames + text) and returns a structured analysis
 * plus actionable recommendations.
 */

import { anthropic, DEFAULT_MODEL } from "./client";
import { z } from "zod";

// --------------------------------------
// Output schema
// --------------------------------------
export const creativeAnalysisSchema = z.object({
  hook: z.string(),
  angle: z.string(),
  format: z.enum([
    "ugc_testimonial",
    "product_demo",
    "before_after",
    "pov",
    "face_to_camera",
    "other",
  ]),
  visual_style: z.string(),
  pacing: z.enum(["lento", "medio", "rápido", "staccato"]),
  audio_type: z.enum([
    "voz_en_off",
    "talento_hablando",
    "solo_musica",
    "trending_sound",
  ]),
  cta: z.string(),
  strengths: z.array(z.string()).min(1),
  weaknesses: z.array(z.string()).min(1),
  performance_fit: z.string(),
  recommendations: z
    .array(
      z.object({
        type: z.enum(["variant", "iteration", "new_angle"]),
        title: z.string(),
        description: z.string(),
        expected_impact: z.string(),
      }),
    )
    .min(1),
});

export type CreativeAnalysis = z.infer<typeof creativeAnalysisSchema>;

// --------------------------------------
// Prompt (PRD §7.3)
// --------------------------------------
export const ANALYST_SYSTEM_PROMPT = `Eres un creative strategist senior especializado en TikTok y Meta Ads para DTC ecommerce.
Has producido ads que generan más de $10M USD al año. Tu análisis es brutal, específico,
accionable.

Analiza este creativo y produce un JSON con esta estructura exacta:

{
  "hook": "primeros 3 segundos, qué pasa y por qué funciona o no",
  "angle": "el ángulo de venta principal (problema-solución, testimonio, demo, etc)",
  "format": "ugc_testimonial | product_demo | before_after | pov | face_to_camera | other",
  "visual_style": "descripción del look",
  "pacing": "lento | medio | rápido | staccato",
  "audio_type": "voz_en_off | talento_hablando | solo_musica | trending_sound",
  "cta": "cuál es el CTA y cuándo aparece",
  "strengths": ["fortaleza 1", "fortaleza 2", "fortaleza 3"],
  "weaknesses": ["debilidad 1", "debilidad 2"],
  "performance_fit": "dado el ROAS/CTR actual, ¿el creativo explica el resultado? sí/no y por qué",
  "recommendations": [
    {
      "type": "variant | iteration | new_angle",
      "title": "nombre corto de la variante",
      "description": "qué cambiar específicamente",
      "expected_impact": "qué se espera mejorar"
    }
  ]
}

NO escribas prosa. SOLO el JSON. Si no puedes analizar algo, pon "N/A" pero nunca inventes.`;

// --------------------------------------
// API
// --------------------------------------
export interface AnalyzeCreativeInput {
  /** Base64-encoded frames (JPEG/PNG) or a single video base64 for short clips. */
  visualContent: Array<{
    type: "image" | "video";
    mediaType: string;
    data: string; // base64
  }>;
  /** Human context attached — ad name, brand, performance so far. */
  context: {
    ad_name: string;
    brand_name: string;
    spend_usd: number;
    revenue_usd: number;
    roas: number;
    ctr: number | null;
    purchases: number;
  };
}

export interface AnalyzeCreativeResult {
  analysis: CreativeAnalysis;
  raw: string;
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export async function analyzeCreative(
  input: AnalyzeCreativeInput,
): Promise<AnalyzeCreativeResult> {
  // Build multimodal content blocks. Videos are not natively supported yet by
  // the SDK message API for most accounts → we require caller to pre-extract
  // frames (at 1fps via ffmpeg).
  const imageBlocks = input.visualContent
    .filter((c) => c.type === "image")
    .map((c) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: c.mediaType as
          | "image/jpeg"
          | "image/png"
          | "image/gif"
          | "image/webp",
        data: c.data,
      },
    }));

  const userText = `Ad: ${input.context.ad_name}
Brand: ${input.context.brand_name}
Performance so far:
  - Spend: $${input.context.spend_usd.toFixed(2)} USD
  - Revenue: $${input.context.revenue_usd.toFixed(2)} USD
  - ROAS: ${input.context.roas.toFixed(2)}x
  - Purchases: ${input.context.purchases}
  - CTR: ${input.context.ctr !== null ? input.context.ctr.toFixed(2) + "%" : "N/A"}

Analiza los frames y devuelve SOLO el JSON requerido.`;

  const response = await anthropic.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 2048,
    system: ANALYST_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [...imageBlocks, { type: "text", text: userText }],
      },
    ],
  });

  const textBlock = response.content.find((c) => c.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Anthropic response missing text content");
  }

  const jsonStr = extractJson(textBlock.text);
  const parsed = creativeAnalysisSchema.parse(JSON.parse(jsonStr));

  return {
    analysis: parsed,
    raw: textBlock.text,
    model: response.model,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}

// --------------------------------------
// Helpers
// --------------------------------------
/** Extract JSON from the model's response, tolerating ```json fences. */
export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced && fenced[1]) return fenced[1].trim();
  // First {...} object in the text.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model response");
  }
  return text.slice(start, end + 1);
}
