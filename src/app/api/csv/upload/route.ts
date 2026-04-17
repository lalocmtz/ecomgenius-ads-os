import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { adAccounts, adSources, brands } from "@/lib/db/schema";
import { parseMetaCsv } from "@/lib/parsers/meta-csv";
import { ingestMetaRows } from "@/lib/pipeline/ingest";
import { logger } from "@/lib/utils/logger";
import { newId } from "@/lib/utils/id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const brandSlug = formData.get("brandSlug") as string | null;

    if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });
    if (!brandSlug)
      return NextResponse.json({ error: "brandSlug is required" }, { status: 400 });

    const [brand] = await db
      .select()
      .from(brands)
      .where(and(eq(brands.slug, brandSlug), eq(brands.ownerId, userId)))
      .limit(1);
    if (!brand) {
      return NextResponse.json({ error: "brand not found" }, { status: 404 });
    }

    const csvText = await file.text();
    const parseResult = parseMetaCsv(csvText);
    if (parseResult.rows.length === 0) {
      return NextResponse.json(
        { error: "CSV parsed with zero rows", failures: parseResult.failures },
        { status: 400 },
      );
    }

    // Ensure a Meta ad account exists for this brand (create if needed)
    const [metaSource] = await db
      .select()
      .from(adSources)
      .where(eq(adSources.name, "meta"))
      .limit(1);
    if (!metaSource) {
      return NextResponse.json(
        { error: "Meta source not seeded. Run npm run db:seed." },
        { status: 500 },
      );
    }

    let [account] = await db
      .select()
      .from(adAccounts)
      .where(and(eq(adAccounts.brandId, brand.id), eq(adAccounts.sourceId, metaSource.id)))
      .limit(1);
    if (!account) {
      const id = newId("acc");
      await db.insert(adAccounts).values({
        id,
        brandId: brand.id,
        sourceId: metaSource.id,
        externalAccountId: null,
        displayName: `${brand.name} — Meta`,
        createdAt: new Date(),
      });
      account = {
        id,
        brandId: brand.id,
        sourceId: metaSource.id,
        externalAccountId: null,
        displayName: `${brand.name} — Meta`,
        createdAt: new Date(),
      };
    }

    const result = await ingestMetaRows({
      db,
      brandId: brand.id,
      accountId: account.id,
      sourceId: metaSource.id,
      uploadedBy: userId,
      filename: file.name,
      rows: parseResult.rows,
    });

    logger.info({ brand: brandSlug, result }, "CSV ingested");
    return NextResponse.json({
      ok: true,
      ...result,
      parseReport: {
        rowsFailed: parseResult.rowsFailed,
        failures: parseResult.failures.slice(0, 20),
      },
    });
  } catch (e) {
    logger.error({ err: e }, "CSV upload failed");
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
