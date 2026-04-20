"use client";

import { useRouter, useSelectedLayoutSegments } from "next/navigation";
import { cn } from "@/lib/utils/cn";

export interface BrandSwitcherBrand {
  slug: string;
  name: string;
}

const BRAND_COLOR: Record<string, string> = {
  "feel-ink": "bg-purple-600 text-white",
  skinglow: "bg-emerald-600 text-white",
};

const BRAND_COLOR_FALLBACK = "bg-verdict-promising text-white";

export function BrandSwitcher({ brands }: { brands: BrandSwitcherBrand[] }) {
  const router = useRouter();
  const segments = useSelectedLayoutSegments();
  const activeSlug = segments[0] && brands.some((b) => b.slug === segments[0]) ? segments[0] : null;

  if (brands.length === 0) return null;

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-raised p-1">
      {brands.map((b) => {
        const active = b.slug === activeSlug;
        const activeClass = BRAND_COLOR[b.slug] ?? BRAND_COLOR_FALLBACK;
        return (
          <button
            key={b.slug}
            type="button"
            onClick={() => router.push(`/${b.slug}`)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition",
              active
                ? activeClass
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
            )}
          >
            {b.name}
          </button>
        );
      })}
    </div>
  );
}
