import { Lightning } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";

export type BookingTag = "NORMAL" | "EMERGENCY" | "DISPUTED" | "CANCELLED";

const tagClasses: Record<BookingTag, string> = {
  NORMAL: "bg-live-tint text-live-ink",
  /* Solid red, not a tint — the type tag is the loudest thing on the row. */
  EMERGENCY: "bg-emergency text-emergency-on",
  DISPUTED: "bg-surface-3 text-text-2",
  CANCELLED: "bg-rose-tint text-rose-ink",
};

/**
 * The booking *type* tag. This is a separate field from operational status and
 * the two are never merged into one chip.
 *
 * An EMERGENCY booking keeps this tag from creation through payment release —
 * it is computed server-side, stored on the record, and immutable.
 */
export function BookingTypeBadge({
  tag,
  size = "md",
  className,
}: {
  tag: BookingTag;
  /** `sm` for dense table rows, `md` for cards. */
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[5px] rounded-pill font-mono font-medium",
        size === "sm"
          ? "px-2.5 py-[5px] text-[10px] tracking-[0.1em]"
          : "px-3 py-[7px] text-[11px] tracking-[0.08em]",
        tagClasses[tag],
        className,
      )}
    >
      {tag === "EMERGENCY" && <Lightning size={13} />}
      {tag}
    </span>
  );
}
