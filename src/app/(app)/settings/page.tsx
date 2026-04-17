import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Settings, ArrowRight } from "lucide-react";
import { getUserBrands } from "@/lib/db/queries/app";

export default async function SettingsPage() {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const brands = await getUserBrands(userId);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Settings className="h-7 w-7 text-text-secondary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
          <p className="mt-1 text-text-secondary">
            Administra marcas, unit economics y thresholds.
          </p>
        </div>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Marcas</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {brands.map((b) => (
            <Link
              key={b.id}
              href={`/${b.slug}/config`}
              className="group flex items-center justify-between rounded-lg border border-border bg-bg-raised p-4 hover:bg-bg-hover"
            >
              <div>
                <h3 className="font-semibold">{b.name}</h3>
                <p className="text-xs text-text-muted">/{b.slug}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-text-muted group-hover:text-text-primary" />
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Cuenta</h2>
        <div className="rounded-lg border border-border bg-bg-raised p-4 text-sm text-text-secondary">
          Administra tu perfil y sesiones desde el menú del avatar (arriba a la izquierda).
        </div>
      </section>
    </div>
  );
}
