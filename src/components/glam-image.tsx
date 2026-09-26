import { Image } from "@imagekit/next";
import { imageKitEndpoint, isTrustedImageUrl } from "@/lib/imagekit";

/**
 * Renders a media-library image, or a branded placeholder.
 *
 * Two reasons this is not just next/image:
 *
 *  1. It refuses to render a URL that is not from our own delivery endpoint.
 *     Reference images are supplied by customers, and an arbitrary remote URL
 *     would let a booking embed a tracking pixel that fires for every vendor
 *     and admin who opens it.
 *  2. When nothing is configured or no image exists, it falls back to the
 *     brand's metal gradient rather than a broken image — so the marketing
 *     page looks deliberate before any photography exists.
 */
export function GlamImage({
  src,
  alt,
  width,
  height,
  className = "",
  sizes,
  priority,
}: {
  src: string | null | undefined;
  alt: string;
  width: number;
  height: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const endpoint = imageKitEndpoint();
  const usable = src && endpoint && isTrustedImageUrl(src);

  if (!usable) {
    return (
      <div
        aria-hidden
        className={`bg-metal ${className}`}
        style={{ aspectRatio: `${width} / ${height}` }}
      />
    );
  }

  return (
    <Image
      urlEndpoint={endpoint}
      src={src.replace(endpoint, "")}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      priority={priority}
      className={className}
      // Let ImageKit crop to the subject and serve the lightest format the
      // browser accepts, rather than shipping the original.
      transformation={[{ width, height, crop: "maintain_ratio", focus: "auto" }]}
    />
  );
}
