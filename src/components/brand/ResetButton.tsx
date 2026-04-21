"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";

interface ResetButtonProps {
  brandSlug: string;
  brandName: string;
}

export function ResetButton({ brandSlug, brandName }: ResetButtonProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "confirm" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    setPhase("loading");
    setError(null);
    try {
      const r = await fetch(`/api/brands/${brandSlug}/reset`, { method: "DELETE" });
      const contentType = r.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        setError("Error del servidor. Intenta de nuevo.");
        setPhase("confirm");
        return;
      }
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? "Error desconocido");
        setPhase("confirm");
        return;
      }
      setPhase("done");
      setTimeout(() => router.push(`/${brandSlug}/upload`), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
      setPhase("confirm");
    }
  }

  if (phase === "done") {
    return (
      <div className="flex items-center gap-2 rounded-md bg-verdict-winner/10 px-4 py-2 text-sm text-verdict-winner">
        Datos borrados. Redirigiendo a carga…
      </div>
    );
  }

  if (phase === "confirm") {
    return (
      <div className="rounded-lg border border-verdict-loser/40 bg-verdict-loser/5 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-verdict-loser" />
          <div>
            <p className="font-semibold text-verdict-loser">¿Borrar todos los datos de {brandName}?</p>
            <p className="mt-1 text-sm text-text-secondary">
              Se eliminarán todos los anuncios, conjuntos, estadísticas e historial de subidas.
              La configuración de la marca (Config) se conserva. Esta acción no se puede deshacer.
            </p>
            {error && (
              <p className="mt-2 text-sm text-verdict-loser">{error}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-md bg-verdict-loser px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Sí, borrar todo
          </button>
          <button
            type="button"
            onClick={() => { setPhase("idle"); setError(null); }}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-bg-hover"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Borrando datos…
      </div>
    );
  }

  // idle
  return (
    <button
      type="button"
      onClick={() => setPhase("confirm")}
      className="flex items-center gap-2 rounded-md border border-verdict-loser/40 px-3 py-1.5 text-sm text-verdict-loser hover:bg-verdict-loser/10 transition-colors"
    >
      <Trash2 className="h-4 w-4" />
      Borrar todo y empezar de cero
    </button>
  );
}
