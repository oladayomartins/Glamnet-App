import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/server/prisma";
import { requireUser } from "@/lib/auth/session";
import { getPricingContext } from "@/lib/server/emergency-config";
import { quoteBooking, BookingError } from "@/lib/server/booking-service";
import { isImageKitConfigured } from "@/lib/imagekit";
import { formatNotice } from "@/lib/domain/classification";
import { EmptyState } from "@/components/ui";
import { ConfirmBooking, type ConfirmQuote } from "./confirm-booking";

export const dynamic = "force-dynamic";

/**
 * Confirm a chosen offer (§C-07), in one step.
 *
 * Search already settled the provider, the service and the time, so this page
 * re-checks rather than re-asks. Everything in the URL is treated as a claim:
 * the hub, the service and the start time are all verified here, and the price
 * is recomputed from scratch by the same engine the booking itself uses. A
 * customer who edits the query string gets a different quote, not a discount.
 *
 * The full builder is still at /book/[hubId] for anyone who arrives without a
 * time already chosen — from a provider profile, or straight from the nav.
 */
export default async function ConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ hubId: string }>;
  searchParams: Promise<{ service?: string; at?: string; provider?: string }>;
}) {
  const [{ hubId }, query] = await Promise.all([params, searchParams]);

  const viewer = await requireUser(
    `/book/${hubId}/confirm?service=${query.service ?? ""}&at=${query.at ?? ""}`,
  );

  const startAt = query.at ? new Date(query.at) : null;
  // A missing or unparseable time is not an error page: it is the builder,
  // which is the screen for choosing one.
  if (!query.service || !startAt || Number.isNaN(startAt.getTime())) {
    return <Redirectish hubId={hubId} />;
  }

  const [hub, service, provider, { thresholdMinutes }] =
    await Promise.all([
      prisma.hub.findUnique({ where: { id: hubId } }),
      prisma.service.findFirst({
        where: { id: query.service, isActive: true },
        select: { id: true, name: true },
      }),
      query.provider
        ? prisma.provider.findFirst({
            where: {
              id: query.provider,
              approvalStatus: "APPROVED",
              isAcceptingWork: true,
            },
            select: { name: true },
          })
        : Promise.resolve(null),
      getPricingContext(),
    ]);

  if (!hub) notFound();
  if (!service) return <Redirectish hubId={hubId} />;

  let quote;
  try {
    quote = await quoteBooking({
      hubId,
      serviceIds: [service.id],
      appointmentStartAt: startAt,
    });
  } catch (error) {
    // A quote that will not build means the time is no longer bookable — which
    // in a marketplace is ordinary, not exceptional.
    if (error instanceof BookingError) return <SlotGone hubId={hubId} />;
    throw error;
  }

  // Nobody free is the same outcome as no quote, and it is the case that
  // actually happens: somebody else took the slot between the list and here.
  if (quote.eligibleProviderIds.length === 0) {
    return <SlotGone hubId={hubId} />;
  }

  const confirmQuote: ConfirmQuote = {
    bookingType: quote.bookingType,
    isEmergency: quote.bookingType === "EMERGENCY",
    noticeLabel: formatNotice(quote.noticePeriodMinutes),
    serviceDurationMinutes: quote.serviceDurationMinutes,
    reservedDurationMinutes: quote.reservedDurationMinutes,
    appointmentStartAt: quote.appointmentStartAt.toISOString(),
    appointmentEndAt: quote.appointmentEndAt.toISOString(),
    reservedUntilAt: quote.reservedUntilAt.toISOString(),
    lines: quote.price.lines,
    totalMinor: quote.price.totalMinor,
  };

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/search"
          className="tap-44 text-sm text-ink-muted hover:text-brand-700"
        >
          ← Back to results
        </Link>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-[-0.02em] text-ink">
          Confirm your booking
        </h1>
        <p className="mt-1 text-[15px] text-ink-muted">
          {quote.eligibleProviderIds.length}{" "}
          {quote.eligibleProviderIds.length === 1 ? "provider is" : "providers are"}{" "}
          free for this slot. The first to accept takes the job.
        </p>
      </div>

      <ConfirmBooking
        hubId={hub.id}
        serviceId={service.id}
        serviceName={service.name}
        providerName={provider?.name ?? null}
        sector={hub.sector}
        customerId={viewer.customerId}
        customerName={viewer.email}
        imageUploadsEnabled={isImageKitConfigured()}
        thresholdHours={Math.round(thresholdMinutes / 60)}
        quote={confirmQuote}
      />
    </div>
  );
}

/** Nothing to confirm yet — the builder is the screen that chooses a time. */
function Redirectish({ hubId }: { hubId: string }) {
  return (
    <div className="py-10">
      <EmptyState
        icon={<Clock size={24} weight="light" />}
        title="Pick a time first"
        action={
          <Link
            href={`/book/${hubId}`}
            className="inline-flex min-h-11 items-center rounded-full bg-metal px-6 text-sm font-bold text-metal-ink active:scale-[0.98]"
          >
            Choose a time
          </Link>
        }
      >
        This page confirms a slot that has already been chosen.
      </EmptyState>
    </div>
  );
}

/**
 * The slot went while the customer was deciding. Ordinary in a marketplace,
 * and caught here rather than after the money.
 */
function SlotGone({ hubId }: { hubId: string }) {
  return (
    <div className="py-10">
      <EmptyState
        icon={<Clock size={24} weight="light" />}
        title="That time has just gone"
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href={`/book/${hubId}`}
              className="inline-flex min-h-11 items-center rounded-full bg-metal px-6 text-sm font-bold text-metal-ink active:scale-[0.98]"
            >
              Pick another time
            </Link>
            <Link
              href="/search"
              className="inline-flex min-h-11 items-center rounded-full bg-surface px-6 text-sm font-semibold text-ink ring-1 ring-line active:scale-[0.98]"
            >
              See who else is free
            </Link>
          </div>
        }
      >
        Somebody booked it while you were deciding. Nothing has been charged.
      </EmptyState>
    </div>
  );
}
