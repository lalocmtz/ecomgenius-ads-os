import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { ads, adsets, adAccounts, brands, creativeAnalyses } from "@/lib/db/schema";
import { analyzeCreative } from "@/lib/anthropic/creative-analyst";
import { uploadToR2 } from "@/lib/storage/r2";
import { newId } from "@/lib/utils/id";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const DAILY_LIMIT = Number(process.env.CREATIVE_ANALYSIS_DAILY_LIMIT ?? 20);

const bodySchema = z.object({
  ad_id: z.string(),
  source_type: z.enum(["link", "upload"]),
  source_url: z.string().url().optional(),
  /** base64 frames (JPEG/PNG) extracted from the source creative (up to ~8). */
  frames: z
    .array(
      z.object({
        mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        data: z.string(),
      }),
    )
    .min(1)
    .max(8),
  /** Optional raw video bytes (only when source_type==='upload' and caller uploaded the file). */
  video_base64: z.string().optional(),
  video_mime: z.string().optional(),
});

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  try {
    const json = await req.json();
    const body = bodySchema.parse(json);

    // --- Rate limit: max N analyses per user per day ---
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const countRow = await db
      .select({ count: sql<number>`COUNT(*)`.as("c") })
      .from(creativeAnalyses)
      .innerJoin(ads, eq(ads.id, creativeAnalyses.adId))
      .innerJoin(adsets, eq(adsets.id, ads.adsetId))
      .innerJoin(adAccounts, eq(adAccounts.id, adsets.accountId))
      .innerJoin(brands, eq(brands.id, adAccounts.brandId))
      .where(
        and(
          eq(brands.ownerId, userId),
          gte(creativeAnalyses.createdAt, dayStart),
        ),
      );
    const todayCount = Number(countRow[0]?.count ?? 0);
    if (todayCount >= DAILY_LIMIT) {
      return NextResponse.json(
        { error: `Rate limit: max ${DAILY_LIMIT} análisis por día.` },
        { status: 429 },
      );
    }

    // --- Load ad + verify ownership ---
    const [adRow] = await db
      .select({
        id: ads.id,
        name: ads.name,
        brandOwner: brands.ownerId,
        brandName: brands.name,
      })
      .from(ads)
      .innerJoin(adsets, eq(adsets.id, ads.adsetId))
      .innerJoin(adAccounts, eq(adAccounts.id, adsets.accountId))
      .innerJoin(brands, eq(brands.id, adAccounts.brandId))
      .where(eq(ads.id, body.ad_id))
      .limit(1);
    if (!adRow || adRow.brandOwner !== userId) {
      return NextResponse.json({ error: "ad not found" }, { status: 404 });
    }

    // --- Upload video to R2 if provided ---
    let videoR2Key: string | null = null;
    if (body.source_type === "upload" && body.video_base64 && body.video_mime) {
      const key = `ads/${adRow.id}/${Date.now()}.mp4`;
      await uploadToR2(
        key,
        Buffer.from(body.video_base64, "base64"),
        body.video_mime,
      );
      videoR2Key = key;
    }

    // --- Run Claude analysis ---
    const result = await analyzeCreative({
      visualContent: body.frames.map((f) => ({
        type: "image",
        mediaType: f.mediaType,
        data: f.data,
      })),
      context: {
        ad_name: adRow.name,
        brand_name: adRow.brandName,
        spend_usd: 0,
        revenue_usd: 0,
        roas: 0,
        ctr: null,
        purchases: 0,
      },
    });

    // --- Persist ---
    const analysisId = newId("analysis");
    await db.insert(creativeAnalyses).values({
      id: analysisId,
      adId: adRow.id,
      sourceType: body.source_type,
      sourceUrl: body.source_url ?? null,
      videoR2Key,
      hook: result.analysis.hook,
      angle: result.analysis.angle,
      format: result.analysis.format,
      visualStyle: result.analysis.visual_style,
      pacing: result.analysis.pacing,
      audioType: result.analysis.audio_type,
      cta: result.analysis.cta,
      analysisFull: JSON.stringify(result.analysis),
      recommendations: JSON.stringify(result.analysis.recommendations),
      costTokensIn: result.usage.input_tokens,
      costTokensOut: result.usage.output_tokens,
      modelUsed: result.model,
      createdAt: new Date(),
    });

    await db
      .update(ads)
      .set({ creativeAnalysisId: analysisId, updatedAt: new Date() })
      .where(eq(ads.id, adRow.id));

    return NextResponse.json({ ok: true, analysisId, analysis: result.analysis });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "validation_error", issues: e.issues },
        { status: 400 },
      );
    }
    logger.error({ err: e }, "Creative analysis failed");
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
