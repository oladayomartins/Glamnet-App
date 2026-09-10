import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Mono eyebrow label — the same treatment as ids, timers and sector codes. */
export function Eyebrow({
  children,
  tone = "muted",
  className,
}: {
  children: ReactNode;
  tone?: "muted" | "rose" | "emergency";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "font-mono text-[11px] tracking-[0.1em] uppercase",
        tone === "rose"
          ? "text-rose"
          : tone === "emergency"
            ? "text-emergency-ink"
            : "text-text-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Small uppercase mono caption used as a card's internal label. */
export function CardLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "font-mono text-[10px] tracking-[0.08em] uppercase text-text-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Card({
  children,
  className,
  tone = "surface-2",
}: {
  children: ReactNode;
  className?: string;
  tone?: "surface-1" | "surface-2" | "rose" | "emergency";
}) {
  return (
    <div
      className={cn(
        "rounded-card p-[22px]",
        tone === "surface-1" && "border border-line bg-surface-1",
        tone === "surface-2" && "border border-line bg-surface-2",
        tone === "rose" && "border border-line bg-rose-tint",
        tone === "emergency" && "border border-emergency bg-emergency-tint",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Section({
  id,
  eyebrow,
  eyebrowTone,
  title,
  lede,
  children,
  className,
}: {
  id?: string;
  eyebrow: string;
  eyebrowTone?: "muted" | "rose" | "emergency";
  title: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("pt-20", className)}>
      <Eyebrow tone={eyebrowTone}>{eyebrow}</Eyebrow>
      <h2 className="mt-2.5 mb-2 text-[clamp(24px,3.1vw,37px)] font-bold tracking-[-0.03em] text-balance">
        {title}
      </h2>
      {lede && (
        <p className="mt-0 mb-[26px] max-w-[62ch] leading-[1.6] text-text-2">
          {lede}
        </p>
      )}
      {children}
    </section>
  );
}
