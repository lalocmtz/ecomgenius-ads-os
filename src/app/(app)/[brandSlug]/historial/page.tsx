import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { History } from "lucide-react";
import { getBrandBySlug, getBrandUploads } from "@/lib/db/queries/brands";
import { formatInt } from "@/lib/utils/format";
import { ResetButton } from "@/components/brand/ResetButton";

export default async function HistorialPage({
  params,
}: {
  params: { brandSlug: string };
}) {
  const { userId } = auth();
  if (!userId) notFound();
  const brand = await getBrandBySlug(params.brandSlug, userId);
  if (!brand) notFound();

  const uploads = await getBrandUploads(brand.id, 50);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <History className="h-7 w-7 text-verdict-promising" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Historial — {brand.name}</h1>
            <p className="mt-1 text-text-secondary">
              Cada subida de CSV queda registrada con rango de fechas y métricas de ingesta.
            </p>
          </div>
        </div>
        <ResetButton brandSlug={brand.slug} brandName={brand.name} />
      </header>

      {uploads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-bg-raised p-12 text-center">
          <p className="text-text-secondary">Aún no hay subidas para esta marca.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-bg-raised">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr className="text-left text-xs uppercase tracking-wider text-text-muted">
                <th className="px-4 py-3">Fecha</th>
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
