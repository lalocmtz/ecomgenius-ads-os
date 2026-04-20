import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { brands } from "@/lib/db/schema";

export default async function RootPage() {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const [first] = await db
    .select({ slug: brands.slug })
    .from(brands)
    .where(eq(brands.ownerId, userId))
    .orderBy(asc(brands.createdAt))
    .limit(1);

  if (!first) {
    redirect("/settings");
  }
  redirect(`/${first.slug}`);
}
