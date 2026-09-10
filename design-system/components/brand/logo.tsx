import { cn } from "@/lib/cn";

type PinVariant = "metal" | "obsidian" | "rose";

/**
 * The GlamNet mark: a map pin with a soft centre — the meeting point of a
 * provider and a customer. Location is the product.
 *
 * The teardrop is a square with three round corners and one sharp one, rotated
 * -45°. The inner dot counter-rotates nothing (it's a circle), so the mark
 * stays optically upright at every size.
 *
 * Never rotate, outline, re-gradient or re-letter it. Minimum icon size 32px.
 */
export function GlamNetPin({
  size = 32,
  variant = "metal",
  dotClassName,
  className,
}: {
  size?: number;
  variant?: PinVariant;
  /**
   * Overrides the counter dot. The dot normally matches the page ground via
   * `--gn-pin-inner`, so it must be set explicitly whenever the pin sits on a
   * plate that does not follow the theme — the obsidian app-icon tile, say.
   */
  dotClassName?: string;
  className?: string;
}) {
  // Corner radius and dot scale with the pin so the silhouette holds.
  const tail = Math.max(3, Math.round(size * 0.16));
  const dot = Math.round(size * 0.31);

  const surface =
    variant === "metal"
      ? "bg-metal"
      : variant === "obsidian"
        ? "bg-[oklch(0.165_0.008_285)]"
        : "bg-rose";

  const dotColour =
    variant === "obsidian"
      ? "bg-[oklch(0.90_0.05_92)]"
      : variant === "rose"
        ? ""
        : "bg-pin-inner";

  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center",
        surface,
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: `50% 50% 50% ${tail}px`,
        transform: "rotate(-45deg)",
      }}
    >
      {/* The rose variant is a solid silhouette — no counter dot. */}
      {variant !== "rose" && (
        <div
          className={cn("rounded-full", dotClassName ?? dotColour)}
          style={{ width: dot, height: dot }}
        />
      )}
    </div>
  );
}

export function Wordmark({
  size = 19,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("font-bold", className)}
      style={{ fontSize: size, letterSpacing: "-0.03em" }}
    >
      GLAMNET
    </div>
  );
}

/**
 * Primary lockup. Clear space on all sides equals the height of the pin;
 * minimum lockup width is 96px.
 */
export function Lockup({
  pinSize = 36,
  wordSize = 22,
  variant = "metal",
  className,
}: {
  pinSize?: number;
  wordSize?: number;
  variant?: PinVariant;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-[11px]", className)}>
      <GlamNetPin size={pinSize} variant={variant} />
      <div
        className="font-bold"
        style={{ fontSize: wordSize, letterSpacing: "-0.035em" }}
      >
        GLAMNET
      </div>
    </div>
  );
}
