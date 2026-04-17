import { Palette, Construction } from "lucide-react";

export default function CreativosPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Palette className="h-7 w-7 text-verdict-inconcluso" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Creativos</h1>
          <p className="mt-1 text-text-secondary">
            Análisis multimodal con Claude — patrones de winners vs losers.
          </p>
        </div>
      </header>
      <div className="rounded-lg border border-dashed border-border bg-bg-raised p-8">
        <div className="flex items-start gap-3">
          <Construction className="mt-0.5 h-5 w-5 text-verdict-borderline" />
          <div>
            <h2 className="font-semibold">En construcción</h2>
            <p className="mt-1 text-sm text-text-secondary">
              El pipeline de análisis creativo requiere extractor de frames y
              credenciales de Cloudflare R2. Entra a un ad desde una marca para
              disparar un análisis manual con el endpoint existente.
            </p>
            <p className="mt-3 text-sm text-text-secondary">
              Fase 2 del PRD: agregación cross-ads (patrones comunes de winners,
              anti-patrones de losers) — endpoint{" "}
              <code className="rounded bg-bg px-1 font-mono">/api/creative-insights</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
