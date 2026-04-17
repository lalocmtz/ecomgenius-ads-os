import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { History } from "lucide-react";
import { getRecentUploads, getUserBrands } from "@/lib/db/queries/app";
import { formatInt } from "@/lib/utils/format";

export default async function HistorialPage() {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const [uploads, brands] = await Promise.all([
    getRecentUploads(userId, 50),
    getUserBrands(userId),
  ]);
  const brandById = new Map(brands.map((b) => [b.id, b]));

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <History className="h-7 w-7 text-verdict-promising" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Historial</h1>
          <p className="mt-1 text-text-secondary">
            Cada subida de CSV queda registrada con rango de fechas y métricas de ingesta.
          </p>
        </div>
      </header>

      {uploads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-bg-raised p-12 text-center">
          <p className="text-text-secondary">Aún no hay subidas.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-bg-raised">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr className="text-left text-xs uppercase tracking-wider text-text-muted">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Marca</th>
                <th className="px-4 py-3">Archivo</th>
                <th className="px-4 py-3">Rango</th>
                <th className="px-4 py-3 text-right">Filas</th>
                <th className="px-4 py-3 text-right">Fallos</th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((u) => (
                <tr key={u.id} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">
                    {new Date(u.createdAt).toISOString().slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="px-4 py-3">{brandById.get(u.brandId)?.name ?? u.brandId}</td>
                  <td className="px-4 py-3 font-mono text-xs">{u.filename}</td>
                  <td className="px-4 py-3 text-xs text-text-secondary">
                    {u.dateRangeStart} → {u.dateRangeEnd}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{formatInt(u.rowsProcessed)}</td>
                  <td
                    className={`px-4 py-3 text-right font-mono ${
                      u.rowsFailed > 0 ? "text-verdict-loser" : "text-text-muted"
                    }`}
                  >
                    {u.rowsFailed}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
