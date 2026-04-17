import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { AppShell } from "@/components/layout/AppShell";
import { getUserBrands } from "@/lib/db/queries/app";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");
  const brands = await getUserBrands(userId);
  return <AppShell brands={brands}>{children}</AppShell>;
}
