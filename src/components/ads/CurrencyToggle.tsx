"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

export type DisplayCurrency = "USD" | "MXN";

export function CurrencyToggle({ active }: { active: DisplayCurrency }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setCurrency(c: DisplayCurrency) {
    const sp = new URLSearchParams(searchParams);
    sp.set("currency", c);
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="inline-flex items-center rounded-md border border-border bg-bg-raised p-1">
      {(["USD", "MXN"] as DisplayCurrency[]).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setCurrency(c)}
          className={cn(
            "rounded px-3 py-1 text-xs font-mono font-medium tracking-wider transition",
            c === active
              ? "bg-verdict-promising text-white"
              : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
