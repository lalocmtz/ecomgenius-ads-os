import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { brands, csvUploads, recommendations } from "@/lib/db/schema";

export async function GET(
  _req: Request,
  { params }: { params: { uploadId: string } },
) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const [upload] = await db
    .select({ uploadId: csvUploads.id, brandId: csvUploads.brandId, ownerId: brands.ownerId })
    .from(csvUploads)
    .innerJoin(brands, eq(brands.id, csvUploads.brandId))
    .where(eq(csvUploads.id, params.uploadId))
    .limit(1);
  if (!upload || upload.ownerId !== userId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const recs = await db
    .select()
    .from(recommendations)
    .where(
      and(
        eq(recommendations.brandId, upload.brandId),
        eq(recommendations.uploadId, params.uploadId),
      ),
    );

  return NextResponse.json({
    recommendations: recs.map((r) => ({
      ...r,
      metricsSnapshot: JSON.parse(r.metricsSnapshot),
    })),
  });
}
