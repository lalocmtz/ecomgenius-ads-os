"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [brandSlug, setBrandSlug] = useState("feel-ink");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
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
        setTimeout(() => router.push(`/${brandSlug}`), 1500);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">Ingesta CSV</h1>
      <p className="mb-6 text-text-secondary">
        Exporta desde Meta Ads Manager con <strong>Desglose → Por día</strong> y
        arrastra el archivo aquí.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="mb-2 block text-sm text-text-secondary">Marca</label>
          <select
            value={brandSlug}
            onChange={(e) => setBrandSlug(e.target.value)}
            className="w-full rounded border border-border bg-bg-raised p-2"
          >
            <option value="feel-ink">Feel Ink</option>
            <option value="skinglow">Skinglow</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm text-text-secondary">
            Archivo CSV (Meta Ads)
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full rounded border border-border bg-bg-raised p-2 text-sm"
          />
        </div>

        <Button type="submit" disabled={!file || submitting}>
          {submitting ? "Procesando…" : "Subir y analizar"}
        </Button>

        {error && (
          <div className="rounded border border-verdict-loser/40 bg-verdict-loser/10 p-3 text-sm text-verdict-loser">
            {error}
          </div>
        )}

        {result !== null && (
          <pre className="overflow-auto rounded border border-border bg-bg-raised p-4 text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </form>
    </main>
  );
}
