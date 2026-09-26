import Link from "next/link";
import { Sparkle, Star } from "@phosphor-icons/react/dist/ssr";
import { Rail } from "@/components/rail";
import { GlamImage } from "@/components/glam-image";
import type { DiscoveryVendor } from "@/lib/server/discovery";

/**
 * One discovery row: a horizontal rail of vendor cards.
 *
 * Each card carries the same reputation rule as everywhere else — a rating
 * only once someone has given one, and "New" rather than a default score
 * otherwise. Getting that wrong here would matter more than most places,
 * because the "New to GLAMNET" row is by definition full of vendors with no
 * reviews, and a rail of identical 5.0s is the most obvious tell there is.
 */
export function DiscoveryRail({
  label,
  vendors,
}: {
  label: string;
  vendors: DiscoveryVendor[];
}) {
  return (
    <Rail label={label}>
      {vendors.map((vendor) => (
        <Link
          key={vendor.id}
          href={`/pro/${vendor.slug}?via=directory`}
          className="group w-[164px] shrink-0 snap-start sm:w-[188px]"
        >
          <span className="block overflow-hidden rounded-glam">
            <GlamImage
              src={vendor.avatarUrl}
              alt={vendor.name}
              width={376}
              height={282}
              sizes="(max-width: 640px) 164px, 188px"
              className="aspect-[4/3] w-full object-cover transition duration-[240ms] ease-glam group-hover:scale-[1.03]"
            />
          </span>
          <span className="mt-2 block truncate font-display text-[15px] font-bold leading-tight text-ink">
            {vendor.name}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
            {vendor.rating === null ? (
              <span className="inline-flex items-center gap-1 font-semibold text-accent-700">
                <Sparkle size={11} weight="fill" aria-hidden />
                New
              </span>
            ) : (
              <span className="inline-flex items-center gap-1" data-numeric>
                <Star size={11} weight="fill" className="text-accent-500" aria-hidden />
                {vendor.rating.toFixed(1)} ({vendor.reviewCount})
              </span>
            )}
            <span aria-hidden>·</span>
            <span className="truncate">
              {vendor.city} · {vendor.sector}
            </span>
          </span>
        </Link>
      ))}
    </Rail>
  );
}
