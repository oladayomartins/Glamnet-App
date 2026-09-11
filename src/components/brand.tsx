/**
 * The GLAMNET mark: a map pin with a soft centre — the meeting point of a
 * vendor and a customer. Location is the product.
 *
 * The teardrop is a square with three round corners and one sharp one, rotated
 * -45°. The metallic fill runs 135°, champagne into rose gold.
 *
 * Never rotate, outline, re-gradient or re-letter it. Minimum icon 32px in
 * standalone use. [brand guide §01]
 */
export function GlamNetPin({
  size = 26,
  className = "",
  dotClassName = "bg-surface",
}: {
  size?: number;
  className?: string;
  dotClassName?: string;
}) {
  const tail = Math.max(3, Math.round(size * 0.16));
  const dot = Math.round(size * 0.31);

  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center bg-metal ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: `50% 50% 50% ${tail}px`,
        transform: "rotate(-45deg)",
      }}
    >
      {/* The counter dot matches the surface behind it, so the pin reads as a
          hole punched through the metal rather than a dot placed on it. Pass
          a different ground via `dotClassName` when the pin sits on canvas. */}
      <span
        className={`rounded-full ${dotClassName}`}
        style={{ width: dot, height: dot }}
      />
    </span>
  );
}
