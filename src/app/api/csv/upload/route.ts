import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { adAccounts, adSources, brandEconomics, brands } from "@/lib/db/schema";
import { parseMetaCsv } from "@/lib/parsers/meta-csv";
import {
  isAggregateMetaCsv,
  parseMetaAggregateCsv,
} from "@/lib/parsers/meta-csv-aggregate";
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

    // Load latest economics — needed by aggregate parser (currency conversion, min_roas)
    const [econ] = await db
      .select()
      .from(brandEconomics)
      .where(eq(brandEconomics.brandId, brand.id))
      .orderBy(brandEconomics.version)
      .limit(1);
    if (!econ) {
      return NextResponse.json(
        { error: "brand has no economics configured" },
        { status: 400 },
      );
    }

    const csvText = await file.text();

    // --- Auto-detect: daily breakdown vs aggregate (period) export ---
    const isAggregate = isAggregateMetaCsv(csvText);
    let rows;
    let parseWarnings: string[] = [];
    let formatDetected: "daily" | "aggregate";
    let rowsFailed = 0;
    let failures: unknown[] = [];

    if (isAggregate) {
      const r = parseMetaAggregateCsv(csvText, {
        exchange_rate: brand.exchangeRate,
        min_roas: econ.minRoas,
      });
      rows = r.rows;
      rowsFailed = r.rowsFailed;
      failures = r.failures.slice(0, 20);
      formatDetected = "aggregate";
      if (r.currencyDetected === "MXN") {
        parseWarnings.push(
          `Valores en MXN convertidos a USD usando TC ${r.exchangeRateApplied}.`,
        );
      }
      parseWarnings.push(
        "Export agregado: sin desglose por día ni por conjunto. El motor clasifica por totales; las reglas de escalamiento sostenido no aplican.",
      );
      parseWarnings.push(
        `Para aprovechar 100% del motor, re-exporta con: Columnas → Personalizar → agregar "Identificador del anuncio", "Nombre/Identificador del conjunto", "Nombre de la campaña", "Impresiones", "Clics". Luego Desglose → Por día.`,
      );
    } else {
      const r = parseMetaCsv(csvText);
      rows = r.rows;
      rowsFailed = r.rowsFailed;
      failures = r.failures.slice(0, 20);
      formatDetected = "daily";
    }

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: "CSV parsed with zero rows",
          formatDetected,
          failures,
        },
        { status: 400 },
      );
    }

    // Ensure a Meta ad account exists for this brand
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
      const now = new Date();
      await db.insert(adAccounts).values({
        id,
        brandId: brand.id,
        sourceId: metaSource.id,
        externalAccountId: null,
        displayName: `${brand.name} — Meta`,
        createdAt: now,
      });
      account = {
        id,
        brandId: brand.id,
        sourceId: metaSource.id,
        externalAccountId: null,
        displayName: `${brand.name} — Meta`,
        createdAt: now,
      };
    }

    const result = await ingestMetaRows({
      db,
      brandId: brand.id,
      accountId: account.id,
      sourceId: metaSource.id,
      uploadedBy: userId,
      filename: file.name,
      rows,
    });

    logger.info({ brand: brandSlug, format: formatDetected, result }, "CSV ingested");
    return NextResponse.json({
      ok: true,
      ...result,
      formatDetected,
      parseWarnings,
      parseReport: {
        rowsFailed,
        failures,
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
