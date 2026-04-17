import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getPendingRecommendations, getUserBrands } from "@/lib/db/queries/app";
import { Target } from "lucide-react";

const ACTION_GROUPS = [
  { key: "kill", label: "🔴 Apagar ahora", tone: "border-verdict-loser/40 bg-verdict-loser/5" },
  { key: "rotate", label: "🟡 Rotar (burning)", tone: "border-verdict-borderline/40 bg-verdict-borderline/5" },
  { key: "pause", label: "🔴 Pausar conjunto", tone: "border-verdict-loser/40 bg-verdict-loser/5" },
  { key: "scale_up", label: "🟢 Escalar", tone: "border-verdict-winner/40 bg-verdict-winner/5" },
  { key: "iterate", label: "🟣 Iterar", tone: "border-verdict-inconcluso/40 bg-verdict-inconcluso/5" },
  { key: "test_new_creatives", label: "🟡 Testear creativos", tone: "border-verdict-borderline/40 bg-verdict-borderline/5" },
  { key: "let_run", label: "🔵 Dejar correr", tone: "border-verdict-promising/40 bg-verdict-promising/5" },
  { key: "keep", label: "⚪ Mantener", tone: "border-border" },
  { key: "hold", label: "⚪ Hold", tone: "border-border" },
];

export default async function TraffickerPage() {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const [recs, brands] = await Promise.all([
    getPendingRecommendations(userId, 200),
    getUserBrands(userId),
  ]);

  const brandById = new Map(brands.map((b) => [b.id, b]));
  const grouped = new Map<string, typeof recs>();
  for (const r of recs) {
    (grouped.get(r.action) ?? grouped.set(r.action, []).get(r.action)!).push(r);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Target className="h-7 w-7 text-verdict-promising" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trafficker</h1>
          <p className="mt-1 text-text-secondary">
            Acciones concretas agrupadas por tipo. Marca ejecutadas conforme avances.
          </p>
        </div>
      </header>

      {recs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-bg-raised p-12 text-center">
          <p className="text-text-secondary">
            No hay recomendaciones pendientes. Sube un CSV para generar análisis.
          </p>
          <Link
            href="/upload"
            className="mt-4 inline-block rounded bg-verdict-winner px-4 py-2 text-sm font-medium text-bg"
          >
            Ir a carga de datos
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {ACTION_GROUPS.map((g) => {
            const list = grouped.get(g.key) ?? [];
            if (list.length === 0) return null;
            return (
              <section
                key={g.key}
                className={`rounded-lg border p-4 ${g.tone}`}
              >
                <header className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold">{g.label}</h2>
                  <span className="rounded bg-bg/50 px-2 py-0.5 font-mono text-xs">
                    {list.length}
                  </span>
                </header>
                <div className="space-y-1.5">
                  {list.map((r) => {
                    const brand = brandById.get(r.brandId);
                    return (
                      <Link
                        key={r.id}
                        href={
                          brand
                            ? `/${brand.slug}/${r.entityType === "ad" ? "ads" : "adsets"}/${r.entityId}`
                            : "#"
                        }
                        className="flex items-start justify-between gap-3 rounded border border-border/50 bg-bg-raised px-3 py-2 text-sm hover:bg-bg-hover"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-text-secondary">{r.reason}</p>
                          <p className="mt-0.5 text-xs text-text-muted">
                            {brand?.name ?? "—"} · {r.entityType}
                          </p>
                        </div>
                        <span className="shrink-0 rounded bg-bg-hover px-2 py-0.5 text-[10px] uppercase tracking-wider">
                          Abrir →
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
