"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AdsetCard } from "@/components/ads/AdsetCard";
import type { AdRow, AdsetRow } from "@/lib/db/queries/dashboard";
import type { DisplayCurrency } from "@/components/ads/CurrencyToggle";

interface InactiveAdsetsSectionProps {
  adsets: AdsetRow[];
  adsByAdset: Record<string, AdRow[]>;
  minRoas: number;
  currency: DisplayCurrency;
  exchangeRate: number;
  brandSlug: string;
}

export function InactiveAdsetsSection({
  adsets,
  adsByAdset,
  minRoas,
  currency,
  exchangeRate,
  brandSlug,
}: InactiveAdsetsSectionProps) {
  const [open, setOpen] = useState(false);

  if (adsets.length === 0) return null;

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <span>
          Mostrar inactivos ({adsets.length})
        </span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {adsets.map((adset) => (
            <AdsetCard
              key={adset.adsetId}
              brandSlug={brandSlug}
              adset={adset}
              action={null}
              actionReason={null}
              ads={adsByAdset[adset.adsetId] ?? []}
              minRoas={minRoas}
              currency={currency}
              exchangeRate={exchangeRate}
              inactive
            />
          ))}
        </div>
      )}
    </div>
  );
}
