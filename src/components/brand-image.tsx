import { brandMediaOrigin } from "@/lib/imagekit";

/** Widths worth generating for art that spans a column or a whole hero. */
const SRCSET_WIDTHS = [480, 768, 1024, 1440];

/**
 * Fixed brand artwork from the media library.
 *
 * Deliberately not {@link GlamImage}, and the distinction is about where the
 * URL comes from rather than where it points:
 *
 *  · GlamImage renders URLs that arrived from somebody else — a vendor's
 *    upload, a customer's reference photo. Those are checked against the
 *    configured endpoint, because an unchecked one is a tracking pixel that
 *    fires for every vendor and admin who opens the booking.
 *  · This renders URLs written in our own source. There is no untrusted input
 *    to guard, so there is nothing for the check to protect against — and
 *    making the marketing page depend on a runtime variable meant an unset
 *    one silently replaced every photograph with a gradient.
 *
 * A plain `img` rather than `next/image` for the same reason: next/image
 * validates against `remotePatterns`, which is itself built from that same
 * variable at build time. ImageKit already resizes and re-encodes through the
 * `tr` query, so the optimisation is happening either way — this just stops
 * two independent pieces of configuration standing between the page and a
 * picture that is known to exist.
 */
export function BrandImage({
  path,
  alt,
  width,
  height,
  className = "",
  sizes,
  priority,
}: {
  /** Path within the media library, e.g. "/GlamNet App Hero Image.png". */
  path: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const origin = brandMediaOrigin();
  // encodeURI, not encodeURIComponent: the path separators have to survive,
  // and several of these filenames carry spaces.
  const base = `${origin}${encodeURI(path)}`;
  const ratio = height / width;

  const transform = (w: number) =>
    `${base}?tr=w-${w},h-${Math.round(w * ratio)},c-maintain_ratio,fo-auto`;

  return (
    /*
     * The lint rule below wants next/image, for optimisation. That is the one
     * thing this component cannot use: next/image validates the host against
     * `remotePatterns`, which is built from the ImageKit endpoint variable at
     * build time — and an unset variable is precisely why these photographs
     * rendered as gradients in production. ImageKit resizes and re-encodes
     * through the `tr` query either way, so switching back would reinstate the
     * bug and buy no optimisation at all.
     */
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={transform(width)}
      srcSet={SRCSET_WIDTHS.map((w) => `${transform(w)} ${w}w`).join(", ")}
      sizes={sizes}
      alt={alt}
      // Intrinsic size on the element itself, so the box is reserved before
      // the bytes arrive and the hero does not shunt the page as it loads.
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding={priority ? "sync" : "async"}
      className={className}
    />
  );
}
