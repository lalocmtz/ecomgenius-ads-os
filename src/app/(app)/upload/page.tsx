"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload as UploadIcon,
  FileSpreadsheet,
  Check,
  AlertCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Brand {
  id: string;
  slug: string;
  name: string;
}

interface UploadResult {
  ok: boolean;
  adsUpserted?: number;
  adsetsUpserted?: number;
  statsInserted?: number;
  recommendations?: { ads: number; adsets: number };
  dateRange?: { start: string; end: string };
  formatDetected?: "daily" | "aggregate";
  parseWarnings?: string[];
}

export default function UploadPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandSlug, setBrandSlug] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/brands")
      .then((r) => r.json())
      .then((d) => {
        setBrands(d.brands ?? []);
        if (d.brands?.[0]?.slug) setBrandSlug(d.brands[0].slug);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !brandSlug) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("brandSlug", brandSlug);
      const r = await fetch("/api/csv/upload", { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? "Upload failed");
      } else {
        setResult(data);
        setTimeout(() => router.push(`/${brandSlug}`), 3000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="flex items-center gap-3">
        <UploadIcon className="h-7 w-7 text-verdict-promising" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Carga de datos</h1>
          <p className="mt-1 text-text-secondary">
            Exporta desde Meta Ads Manager. Detectamos automáticamente si es
            desglose por día o agregado por período.
          </p>
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-lg border border-border bg-bg-raised p-6"
      >
        <div>
          <label className="mb-2 block text-sm font-medium text-text-secondary">
            Marca
          </label>
          <select
            value={brandSlug}
            onChange={(e) => setBrandSlug(e.target.value)}
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-verdict-promising focus:outline-none"
            required
          >
            <option value="" disabled>
              Elige una marca…
            </option>
            {brands.map((b) => (
              <option key={b.id} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-text-secondary">
            Archivo CSV
          </label>
          <label
            htmlFor="csv-input"
            className="flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-border bg-bg px-6 py-10 transition hover:border-verdict-promising/40 hover:bg-bg-hover"
          >
            <div className="text-center">
              <FileSpreadsheet className="mx-auto h-10 w-10 text-text-muted" />
              <p className="mt-3 text-sm">
                {file ? (
                  <span className="font-mono text-text-primary">{file.name}</span>
                ) : (
                  <span className="text-text-secondary">
                    Arrastra el CSV aquí o{" "}
                    <span className="text-verdict-promising">selecciona archivo</span>
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                Meta Ads Manager · acepta agregado (MXN/USD) o desglose por día
              </p>
            </div>
            <input
              id="csv-input"
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
        </div>

        <Button type="submit" disabled={!file || !brandSlug || submitting} size="lg">
          {submitting ? "Procesando…" : "Subir y analizar"}
        </Button>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-verdict-loser/40 bg-verdict-loser/5 p-3 text-sm text-verdict-loser">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result?.ok && (
          <div className="space-y-3 rounded-md border border-verdict-winner/40 bg-verdict-winner/5 p-4">
            <div className="flex items-center gap-2 font-semibold text-verdict-winner">
              <Check className="h-4 w-4" /> Ingestado correctamente
              {result.formatDetected && (
                <span className="ml-auto rounded bg-bg/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-secondary">
                  {result.formatDetected === "daily" ? "Desglose por día" : "Agregado"}
                </span>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
              <Stat label="Ads" value={result.adsUpserted ?? 0} />
              <Stat label="Conjuntos" value={result.adsetsUpserted ?? 0} />
              <Stat label="Filas" value={result.statsInserted ?? 0} />
              <Stat
                label="Recomendaciones"
                value={(result.recommendations?.ads ?? 0) + (result.recommendations?.adsets ?? 0)}
              />
            </dl>
            <p className="text-xs text-text-muted">
              Redirigiendo al dashboard de la marca…
            </p>
          </div>
        )}

        {result?.parseWarnings && result.parseWarnings.length > 0 && (
          <div className="space-y-2 rounded-md border border-verdict-borderline/40 bg-verdict-borderline/5 p-4 text-sm">
            <div className="flex items-center gap-2 font-semibold text-verdict-borderline">
              <Info className="h-4 w-4" /> Avisos del parser
            </div>
            <ul className="list-disc space-y-1 pl-5 text-text-secondary">
              {result.parseWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </form>

      <aside className="rounded-lg border border-border bg-bg-raised p-5 text-sm">
        <h3 className="flex items-center gap-2 font-semibold">
          <Info className="h-4 w-4 text-verdict-promising" /> Cómo exportar correctamente en Meta
        </h3>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-text-secondary">
          <li>Ads Manager → Columnas → Personalizar columnas.</li>
          <li>
            Activa: Identificador del anuncio, Nombre/Identificador del conjunto,
            Nombre de la campaña, Impresiones, Clics (todos), CPC, CPM, Frecuencia,
            Compras, Valor de conversión, Pagos iniciados, Artículos al carrito.
          </li>
          <li>
            Desglose → <strong>Por día</strong>.
          </li>
          <li>Exportar a CSV y subirlo aquí.</li>
        </ol>
        <p className="mt-3 text-xs text-text-muted">
          Si subes un export agregado (sin &quot;Día&quot;), igual lo aceptamos y convertimos MXN→USD,
          pero pierdes detección de &quot;sostenido 5 días&quot; para escalamientos.
        </p>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-text-muted">{label}</dt>
      <dd className="font-mono text-sm">{value}</dd>
    </div>
  );
}
