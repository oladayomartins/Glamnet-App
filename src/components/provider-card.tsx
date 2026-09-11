import Link from "next/link";
import {
  Lightning,
  MapPin,
  ShieldCheck,
  Star,
} from "@phosphor-icons/react/dist/ssr";
import { GlamImage } from "@/components/glam-image";
import { Skeleton } from "@/components/ui";
import { formatMoney } from "@/lib/format";

export interface ProviderCardData {
  id: string;
  name: string;
  /** Where the booking flow for this provider starts. */
  href: string;
  rating: number;
  reviewCount: number;
  city: string;
  sector: string;
  /** Cheapest bookable service, in pence. Null when the provider has none. */
  fromMinor: number | null;
  /** Flat travel fee for this sector, in pence. */
  travelFeeMinor: number;
  vetted: boolean;
  /** Media-library photo. Empty until the provider has uploaded one. */
  imageUrl: string;
  /**
   * Free for a booking this evening, computed against the real calendar.
   * This is the ONLY place on a card where signal red is allowed.
   */
  freeTonight: boolean;
  specialities: string[];
}

/**
 * The GLAMNET provider card.
 *
 * A card without proximity is not a GlamNet card, so the location row is not
 * optional: pin, city, sector, and what the journey costs. The catalogue has
 * no travel-time estimate behind it — there is no routing data in the system —
 * so the card states the travel fee, which is a real number, rather than
 * inventing "25 min away".
 *
 * Exactly one badge may sit on the image, and `Free tonight` is the only red
 * element permitted anywhere on a card.
 */
export function ProviderCard({ provider }: { provider: ProviderCardData }) {
  return (
    <Link
      href={provider.href}
      className="group flex flex-col overflow-hidden rounded-glam border border-line bg-surface shadow-card transition duration-[180ms] ease-glam hover:-translate-y-0.5 hover:shadow-raised"
    >
      {/* 4:3 portfolio image. GlamImage falls back to the brand metal when a
          provider has no photo yet — a legitimate fill, and the one thing the
          slot must not do is collapse, or the grid reflows when photos land. */}
      <div className="relative aspect-[4/3] w-full">
        <GlamImage
          src={provider.imageUrl}
          alt=""
          width={432}
          height={324}
          sizes="(max-width: 640px) 100vw, 216px"
          className="h-full w-full object-cover"
        />
        <span className="absolute left-3 top-3">
          {provider.freeTonight ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emergency px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-on-emergency">
              <Lightning size={11} weight="fill" aria-hidden />
              Free tonight
            </span>
          ) : provider.vetted ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface/95 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-normal-ink">
              <ShieldCheck size={11} weight="fill" className="text-normal" aria-hidden />
              Vetted
            </span>
          ) : null}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-sm font-bold text-ink">{provider.name}</h3>
          <span className="flex shrink-0 items-center gap-1 text-xs" data-numeric>
            <Star size={12} weight="fill" className="text-accent-500" aria-hidden />
            <span className="font-semibold text-ink">
              {provider.rating.toFixed(1)}
            </span>
            <span className="text-ink-muted">({provider.reviewCount})</span>
          </span>
        </div>

        <p className="mt-1.5 flex items-center gap-1 truncate text-xs text-ink-muted">
          <MapPin size={13} className="shrink-0" aria-hidden />
          {provider.city} · {provider.sector} ·{" "}
          <span data-numeric>{formatMoney(provider.travelFeeMinor)} travel</span>
        </p>

        {provider.specialities.length > 0 ? (
          <p className="mt-2 truncate text-xs text-ink-muted">
            {provider.specialities.slice(0, 3).join(" · ")}
          </p>
        ) : null}

        {/* Hairline rule above the price row, `View` in rose gold. */}
        <div className="mt-auto flex items-baseline justify-between gap-2 border-t border-line pt-3">
          <span className="text-xs text-ink-muted">
            {provider.fromMinor === null ? (
              "Price on request"
            ) : (
              <>
                From{" "}
                <span
                  data-numeric
                  className="text-[15px] font-bold text-accent-700"
                >
                  {formatMoney(provider.fromMinor)}
                </span>
              </>
            )}
          </span>
          <span className="text-xs font-semibold text-brand-700 group-hover:underline">
            View
          </span>
        </div>
      </div>
    </Link>
  );
}

/**
 * The loading state for a provider card: the same footprint, shimmering.
 * Never a spinner.
 */
export function ProviderCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-glam border border-line bg-surface shadow-card">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-2 p-3.5">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <div className="border-t border-line pt-3">
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
    </div>
  );
}

/**
 * The grid every list of providers uses. `auto-fill` with a minimum track
 * means it reflows four-up to one-up on its own — there is no breakpoint here
 * to keep in step with the search page's.
 */
export function ProviderGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(216px,1fr))]">
      {children}
    </div>
  );
}
