import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getBrandBySlug } from "@/lib/db/queries/brands";
import { UploadClient } from "./UploadClient";

export default async function UploadPage({
  params,
}: {
  params: { brandSlug: string };
}) {
  const { userId } = auth();
  if (!userId) notFound();
  const brand = await getBrandBySlug(params.brandSlug, userId);
  if (!brand) notFound();

  return <UploadClient brandSlug={brand.slug} brandName={brand.name} />;
}
