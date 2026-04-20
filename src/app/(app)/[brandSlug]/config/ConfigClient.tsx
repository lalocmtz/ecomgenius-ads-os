"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Calculator } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { calculateBrandThresholds } from "@/lib/rules-engine/thresholds";
import { formatRoas, formatUsd } from "@/lib/utils/format";

interface EconomicsFormValues {
  aov_mxn: number;
  cogs_per_order_mxn: number;
  shipping_mxn: number;
  shopify_fee_mxn: number;
  payment_fee_mxn: number;
  target_margin_pct: number;
  min_roas: number;
  pieces_per_order: number;
  exchange_rate: number;
}

export interface AdsetPreviewRow {
  spendUsd: number;
  revenueUsd: number;
}

interface ConfigClientProps {
  brandSlug: string;
  brandName: string;
  version: number;
  initial: EconomicsFormValues;
  adsetsForPreview: AdsetPreviewRow[];
}

const ADSET_BORDERLINE_ROAS_FLOOR = 1.5;
const PAUSE_SPEND_FLOOR_USD = 200;

export function ConfigClient({
  brandSlug,
  brandName,
  version,
  initial,
  adsetsForPreview,
}: ConfigClientProps) {
  const router = useRouter();
  const [values, setValues] = useState<EconomicsFormValues>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { thresholds, thresholdError } = useMemo(() => {
    try {
      return { thresholds: calculateBrandThresholds(values), thresholdError: null };
    } catch (e) {
      return {
        thresholds: null,
        thresholdError: e instanceof Error ? e.message : "Unit economics inválidos",
      };
    }
  }, [values]);

  const pauseCount = useMemo(() => {
    return adsetsForPreview.filter((a) => {
      const roas = a.spendUsd > 0 ? a.revenueUsd / a.spendUsd : 0;
      return (
        roas < ADSET_BORDERLINE_ROAS_FLOOR && a.spendUsd > PAUSE_SPEND_FLOOR_USD
      );
    }).length;
  }, [adsetsForPreview]);

  const testRotateCount = useMemo(() => {
    if (!thresholds) return 0;
    return adsetsForPreview.filter((a) => {
      const roas = a.spendUsd > 0 ? a.revenueUsd / a.spendUsd : 0;
      return roas >= ADSET_BORDERLINE_ROAS_FLOOR && roas < thresholds.min_roas;
    }).length;
  }, [adsetsForPreview, thresholds]);

  const scaleCount = useMemo(() => {
    if (!thresholds) return 0;
    return adsetsForPreview.filter((a) => {
      const roas = a.spendUsd > 0 ? a.revenueUsd / a.spendUsd : 0;
      return roas >= thresholds.min_roas;
    }).length;
  }, [adsetsForPreview, thresholds]);

  function update<K extends keyof EconomicsFormValues>(
    key: K,
    raw: string,
  ) {
    const num = Number(raw);
    setValues((v) => ({ ...v, [key]: Number.isFinite(num) ? num : v[key] }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const r = await fetch(`/api/brands/${brandSlug}/economics`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        const data = await r.json();
        if (!r.ok) {
          setError(data.error ?? "No se pudo guardar");
          return;
        }
        setSaved(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "unknown");
      }
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">
          Config — {brandName}
        </h1>
        <p className="mt-1 text-text-secondary">
          Unit economics (versión {version}). Guardar crea una nueva versión
          inmutable.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-border bg-bg-raised p-6">
          <h2 className="mb-4 text-lg font-semibold">Inputs</h2>
          <div className="grid gap-4">
            <NumberField
              label="AOV (MXN)"
              value={values.aov_mxn}
              onChange={(v) => update("aov_mxn", v)}
              step="0.01"
            />
            <NumberField
              label="COGS / pedido (MXN)"
              value={values.cogs_per_order_mxn}
              onChange={(v) => update("cogs_per_order_mxn", v)}
              step="0.01"
            />
            <NumberField
              label="Envío (MXN)"
              value={values.shipping_mxn}
              onChange={(v) => update("shipping_mxn", v)}
              step="0.01"
            />
            <NumberField
              label="Shopify fee (MXN)"
              value={values.shopify_fee_mxn}
              onChange={(v) => update("shopify_fee_mxn", v)}
              step="0.01"
            />
            <NumberField
              label="Payment fee (MXN)"
              value={values.payment_fee_mxn}
              onChange={(v) => update("payment_fee_mxn", v)}
              step="0.01"
            />
            <NumberField
              label="Margen objetivo (0-1)"
              value={values.target_margin_pct}
              onChange={(v) => update("target_margin_pct", v)}
              step="0.01"
              min="0"
              max="0.99"
              hint={`Actual: ${(values.target_margin_pct * 100).toFixed(1)}%`}
            />
            <NumberField
              label="Min ROAS"
              value={values.min_roas}
              onChange={(v) => update("min_roas", v)}
              step="0.01"
            />
            <NumberField
              label="Piezas / pedido"
              value={values.pieces_per_order}
              onChange={(v) => update("pieces_per_order", v)}
              step="1"
              min="1"
            />
            <NumberField
              label="TC MXN/USD"
              value={values.exchange_rate}
              onChange={(v) => update("exchange_rate", v)}
              step="0.01"
            />
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-lg border border-verdict-winner/40 bg-verdict-winner/5 p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Calculator className="h-4 w-4 text-verdict-winner" />
              Thresholds (preview en vivo)
            </h2>
            {thresholdError ? (
              <p className="text-sm text-verdict-loser">{thresholdError}</p>
            ) : thresholds ? (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Field label="AOV USD" value={formatUsd(thresholds.aov_usd)} />
                <Field
                  label="CAC target"
                  value={formatUsd(thresholds.cac_target_usd)}
                />
                <Field
                  label="CAC breakeven"
                  value={formatUsd(thresholds.cac_breakeven_usd)}
                />
                <Field
                  label="Test threshold (2×CAC)"
                  value={formatUsd(thresholds.test_threshold_usd)}
                />
                <Field
                  label="Margen / pedido MXN"
                  value={`$${thresholds.margin_per_order_mxn.toFixed(2)}`}
                />
                <Field
                  label="Total cost / pedido MXN"
                  value={`$${thresholds.total_cost_per_order_mxn.toFixed(2)}`}
                />
                <Field
                  label="Min ROAS"
                  value={formatRoas(thresholds.min_roas)}
                />
              </dl>
            ) : null}
          </section>

          <section className="rounded-lg border border-border bg-bg-raised p-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
              Impacto sobre {adsetsForPreview.length} conjuntos
            </h2>
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <PreviewPill
                color="verdict-winner"
                label="Escalables"
                count={scaleCount}
              />
              <PreviewPill
                color="verdict-borderline"
                label="Rotar creativos"
                count={testRotateCount}
              />
              <PreviewPill
                color="verdict-loser"
                label="Pausar"
                count={pauseCount}
              />
            </dl>
            <p className="mt-3 text-xs text-text-muted">
              Estimado sobre rollup total. La clasificación final incluye ROAS
              cuenta y días sostenidos.
            </p>
          </section>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending || !!thresholdError}>
              {pending ? "Guardando…" : "Guardar nueva versión"}
            </Button>
            {saved && (
              <span className="flex items-center gap-1 text-sm text-verdict-winner">
                <Check className="h-4 w-4" /> Guardado
              </span>
            )}
            {error && (
              <span className="flex items-center gap-1 text-sm text-verdict-loser">
                <AlertCircle className="h-4 w-4" /> {error}
              </span>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
  min,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
  step?: string;
  min?: string;
  max?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        step={step}
        min={min}
        max={max}
        className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-1.5 font-mono text-sm focus:border-verdict-promising focus:outline-none"
      />
      {hint && <span className="mt-0.5 block text-[10px] text-text-muted">{hint}</span>}
    </label>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-text-muted">
        {label}
      </dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}

function PreviewPill({
  color,
  label,
  count,
}: {
  color: "verdict-winner" | "verdict-borderline" | "verdict-loser";
  label: string;
  count: number;
}) {
  return (
    <div
      className={`rounded-md border border-${color}/40 bg-${color}/5 p-3 text-center`}
    >
      <div className={`font-mono text-2xl font-semibold text-${color}`}>
        {count}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-text-muted">
        {label}
      </div>
    </div>
  );
}
