import Link from "next/link";
import { cn } from "@/lib/utils/cn";

const actionStyles: Record<string, { label: string; classes: string; icon: string }> = {
  kill: { label: "APAGAR", classes: "bg-verdict-loser/10 border-verdict-loser/40", icon: "🔴" },
  rotate: {
    label: "ROTAR",
    classes: "bg-verdict-borderline/10 border-verdict-borderline/40",
    icon: "🟡",
  },
  scale_up: {
    label: "ESCALAR",
    classes: "bg-verdict-winner/10 border-verdict-winner/40",
    icon: "🟢",
  },
  let_run: {
    label: "DEJAR CORRER",
    classes: "bg-verdict-promising/10 border-verdict-promising/40",
    icon: "🔵",
  },
  iterate: {
    label: "ITERAR",
    classes: "bg-verdict-inconcluso/10 border-verdict-inconcluso/40",
    icon: "🟣",
  },
  keep: { label: "MANTENER", classes: "border-border", icon: "⚪" },
  pause: {
    label: "PAUSAR CONJUNTO",
    classes: "bg-verdict-loser/10 border-verdict-loser/40",
    icon: "🔴",
  },
  hold: { label: "HOLD", classes: "border-border", icon: "⚪" },
  test_new_creatives: {
    label: "TESTEAR CREATIVOS",
    classes: "bg-verdict-borderline/10 border-verdict-borderline/40",
    icon: "🟡",
  },
};

interface RecommendationCardProps {
  brandSlug: string;
  entityType: "ad" | "adset";
  entityId: string;
  entityName: string;
  action: string;
  reason: string;
}

export function RecommendationCard({
  brandSlug,
  entityType,
  entityId,
  entityName,
  action,
  reason,
}: RecommendationCardProps) {
  const style = actionStyles[action] ?? actionStyles.keep!;
  return (
    <div
      className={cn(
        "rounded-lg border bg-bg-raised p-4 transition hover:bg-bg-hover",
        style.classes,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wider">
              {style.icon} {style.label}
            </span>
          </div>
          <h3 className="mt-1 font-semibold">{entityName}</h3>
          <p className="mt-1 text-sm text-text-secondary">{reason}</p>
        </div>
        <Link
          href={`/${brandSlug}/${entityType === "ad" ? "ads" : "adsets"}/${entityId}`}
          className="whitespace-nowrap rounded border border-border px-3 py-1 text-xs hover:bg-bg-hover"
        >
          Ver →
        </Link>
      </div>
    </div>
  );
}
