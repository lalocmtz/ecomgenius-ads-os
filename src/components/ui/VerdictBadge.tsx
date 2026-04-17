import { cn } from "@/lib/utils/cn";
import type { AdVerdict } from "@/lib/rules-engine/types";

const styles: Record<AdVerdict, string> = {
  WINNER: "bg-verdict-winner/20 text-verdict-winner border-verdict-winner/40",
  LOSER: "bg-verdict-loser/20 text-verdict-loser border-verdict-loser/40",
  BORDERLINE:
    "bg-verdict-borderline/20 text-verdict-borderline border-verdict-borderline/40",
  PROMISING:
    "bg-verdict-promising/20 text-verdict-promising border-verdict-promising/40",
  INCONCLUSO:
    "bg-verdict-inconcluso/20 text-verdict-inconcluso border-verdict-inconcluso/40",
  KILLED: "bg-verdict-killed/20 text-verdict-killed border-verdict-killed/40",
};

export function VerdictBadge({
  verdict,
  className,
}: {
  verdict: AdVerdict;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs uppercase tracking-wider",
        styles[verdict],
        className,
      )}
    >
      {verdict}
    </span>
  );
}
