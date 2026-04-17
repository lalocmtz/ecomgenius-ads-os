import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getBrandBySlug, getBrandEconomics } from "@/lib/db/queries/brands";
import { calculateBrandThresholds } from "@/lib/rules-engine";
import { formatUsd, formatRoas } from "@/lib/utils/format";

export default async function BrandConfigPage({
  params,
}: {
  params: { brandSlug: string };
}) {
  const { userId } = auth();
  if (!userId) notFound();

  const brand = await getBrandBySlug(params.brandSlug, userId);
  if (!brand) notFound();
  const econ = await getBrandEconomics(brand.id);
  if (!econ) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-4 text-3xl font-bold">Config — {brand.name}</h1>
        <p className="text-text-secondary">
          Unit economics no configurados aún.
        </p>
      </main>
    );
  }

  const thresholds = calculateBrandThresholds({
    aov_mxn: econ.aovMxn,
    cogs_per_order_mxn: econ.cogsPerOrderMxn,
    shipping_mxn: econ.shippingMxn,
    shopify_fee_mxn: econ.shopifyFeeMxn,
    payment_fee_mxn: econ.paymentFeeMxn,
    target_margin_pct: econ.targetMarginPct,
    min_roas: econ.minRoas,
    pieces_per_order: econ.piecesPerOrder,
    exchange_rate: brand.exchangeRate,
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">Config — {brand.name}</h1>
      <p className="mb-8 text-text-secondary">
        Unit economics (versión {econ.version}) y thresholds derivados.
      </p>

      <section className="mb-8 rounded border border-border bg-bg-raised p-6">
        <h2 className="mb-4 text-lg font-semibold">Inputs</h2>
        <dl className="grid gap-3 md:grid-cols-2">
          <Field label="AOV (MXN)" value={`$${econ.aovMxn.toFixed(2)}`} />
          <Field label="COGS / pedido (MXN)" value={`$${econ.cogsPerOrderMxn.toFixed(2)}`} />
          <Field label="Envío (MXN)" value={`$${econ.shippingMxn.toFixed(2)}`} />
          <Field label="Shopify fee (MXN)" value={`$${econ.shopifyFeeMxn.toFixed(2)}`} />
          <Field label="Payment fee (MXN)" value={`$${econ.paymentFeeMxn.toFixed(2)}`} />
          <Field label="Margen objetivo" value={`${(econ.targetMarginPct * 100).toFixed(1)}%`} />
          <Field label="Min ROAS" value={formatRoas(econ.minRoas)} />
          <Field label="TC MXN/USD" value={brand.exchangeRate.toFixed(2)} />
          <Field label="Piezas / pedido" value={String(econ.piecesPerOrder)} />
        </dl>
      </section>

      <section className="rounded border border-verdict-winner/40 bg-verdict-winner/5 p-6">
        <h2 className="mb-4 text-lg font-semibold">Thresholds derivados</h2>
        <dl className="grid gap-3 md:grid-cols-2">
          <Field label="AOV USD" value={formatUsd(thresholds.aov_usd)} />
          <Field label="CAC target USD" value={formatUsd(thresholds.cac_target_usd)} />
          <Field
            label="CAC breakeven USD"
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
        </dl>
      </section>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-text-muted">{label}</dt>
      <dd className="mt-0.5 font-mono">{value}</dd>
    </div>
  );
}
