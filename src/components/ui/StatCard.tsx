import { cn } from "@/lib/utils/cn";

interface StatCardProps {
  label: string;
  value: string;
  delta?: { direction: "up" | "down" | "flat"; label: string };
  mono?: boolean;
  className?: string;
}

export function StatCard({ label, value, delta, mono = true, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-bg-raised p-4",
        className,
      )}
    >
      <div className="text-xs uppercase tracking-wider text-text-muted">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold text-text-primary",
          mono && "font-mono",
        )}
      >
        {value}
      </div>
      {delta && (
        <div
          className={cn(
            "mt-1 text-xs",
            delta.direction === "up" && "text-verdict-winner",
            delta.direction === "down" && "text-verdict-loser",
            delta.direction === "flat" && "text-text-muted",
          )}
        >
          {delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "•"}{" "}
          {delta.label}
        </div>
      )}
    </div>
  );
}
