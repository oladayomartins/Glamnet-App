import type { ReactNode } from "react";
import { Card } from "@/components/ui";

/** Page heading used across the console. */
export function AdminHeader({ title, lede, action }: { title: string; lede: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">{lede}</p>
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "gold" | "warning";
}) {
  return (
    <Card className="p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">{label}</p>
      <p
        data-numeric
        className={`mt-1.5 font-display text-2xl font-bold tabular-nums ${
          tone === "gold" ? "text-accent-700" : tone === "warning" ? "text-warning" : "text-ink"
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-ink-muted">{hint}</p> : null}
    </Card>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rise-in rounded-glam border-l-4 border-warning bg-sunken p-3 text-sm text-ink">
      {children}
    </p>
  );
}

export const fieldClass =
  "mt-1 w-full rounded-glam-sm border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent-500";
