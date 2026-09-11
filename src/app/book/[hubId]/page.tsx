import { notFound } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { getPricingContext } from "@/lib/server/emergency-config";
import { requireUser } from "@/lib/auth/session";
import { BookingFlow } from "./booking-flow";

/**
 * Steps 2–8 of the booking journey (spec §13): service selection, reference
 * upload, add-ons, date & time, notice period, duration, availability, price.
 */
export default async function BookPage({
  params,
}: {
  params: Promise<{ hubId: string }>;
}) {
  const { hubId } = await params;

  // Booking requires an account: the booking is placed against a real
  // customer record, and payment is authorised against them.
  const viewer = await requireUser(`/book/${hubId}`);

  const [hub, services, { config, thresholdMinutes }] =
    await Promise.all([
      prisma.hub.findUnique({ where: { id: hubId } }),
      prisma.service.findMany({
        where: { isActive: true, providers: { some: { provider: { hubId } } } },
        orderBy: [{ kind: "asc" }, { category: "asc" }, { name: "asc" }],
      }),
      getPricingContext(),
    ]);

  if (!hub) notFound();

  return (
    <BookingFlow
      hub={hub}
      services={services}
      customerId={viewer.customerId}
      customerName={viewer.email}
      thresholdMinutes={thresholdMinutes}
      surchargeType={config?.surchargeType ?? null}
      surchargeValue={config?.surchargeValue ?? null}
    />
  );
}
