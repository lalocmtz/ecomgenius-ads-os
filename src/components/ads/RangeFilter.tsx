"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { RANGE_KEYS, RANGE_LABELS, type RangeKey } from "@/lib/utils/date-range";

export function RangeFilter({ active }: { active: RangeKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setRange(key: RangeKey) {
    const sp = new URLSearchParams(searchParams);
    sp.set("range", key);
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="inline-flex items-center rounded-md border border-border bg-bg-raised p-1">
      {RANGE_KEYS.map((k) => {
        const isActive = k === active;
        return (
          <button
            key={k}
            type="button"
            onClick={() => setRange(k)}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium uppercase tracking-wider transition",
              isActive
                ? "bg-verdict-promising text-white"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
            )}
          >
            {RANGE_LABELS[k]}
          </button>
        );
      })}
    </div>
  );
}
