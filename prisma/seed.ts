/**
 * Development seed: two Beauty Hubs, a service catalogue, six providers with
 * real working windows, and a couple of existing bookings so the provider
 * calendar and the conflict rules are visible immediately.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Mon–Sat, 09:00–20:00. */
const STANDARD_WEEK = [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  startMinute: 9 * 60,
  endMinute: 20 * 60,
}));

/** Every day, 08:00–22:00 — providers who take short-notice work. */
const EXTENDED_WEEK = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  startMinute: 8 * 60,
  endMinute: 22 * 60,
}));

async function main() {
  // Order matters: children before parents.
  await prisma.notification.deleteMany();
  await prisma.bookingStatusEvent.deleteMany();
  await prisma.bookingBroadcast.deleteMany();
  await prisma.bookingItem.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.providerAvailability.deleteMany();
  await prisma.providerTimeOff.deleteMany();
  await prisma.providerService.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.service.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.hub.deleteMany();
  await prisma.emergencyPricingConfig.deleteMany();

  // --- Emergency pricing ---------------------------------------------------
  // Placeholder commercial terms: the spec leaves the surcharge value to be
  // confirmed by the client, so it is seeded as an editable admin config row.
  await prisma.emergencyPricingConfig.create({
    data: {
      thresholdMinutes: 720,
      surchargeType: "PERCENTAGE",
      surchargeValue: 2_500, // 25%
      isActive: true,
      note: "Placeholder rate — awaiting confirmation of the commercial value.",
    },
  });

  // --- Hubs ----------------------------------------------------------------
  const sheffield = await prisma.hub.create({
    data: { name: "Sheffield South", sector: "S11", city: "Sheffield", travelFeeMinor: 500 },
  });
  const leeds = await prisma.hub.create({
    data: { name: "Leeds Central", sector: "LS1", city: "Leeds", travelFeeMinor: 650 },
  });

  // --- Services ------------------------------------------------------------
  const catalogue = [
    { key: "updo", name: "Prom Updo", priceMinor: 8_000, durationMinutes: 75, kind: "SERVICE", category: "Hair", description: "Sculpted occasion updo with finishing spray." },
    { key: "blowdry", name: "Luxury Blow Dry", priceMinor: 4_500, durationMinutes: 45, kind: "SERVICE", category: "Hair", description: "Wash, treatment and smooth blow dry." },
    { key: "braids", name: "Knotless Braids", priceMinor: 12_000, durationMinutes: 180, kind: "SERVICE", category: "Hair", description: "Full head knotless braids, medium size." },
    { key: "glam", name: "Glam Makeup", priceMinor: 6_500, durationMinutes: 45, kind: "SERVICE", category: "Makeup", description: "Full glam with long-wear base." },
    { key: "bridal", name: "Bridal Makeup", priceMinor: 15_000, durationMinutes: 90, kind: "SERVICE", category: "Makeup", description: "Bridal makeup with trial notes applied." },
    { key: "gelmani", name: "Gel Manicure", priceMinor: 3_500, durationMinutes: 60, kind: "SERVICE", category: "Nails", description: "Shape, cuticle work and gel colour." },
    { key: "lashes", name: "Cluster Lashes", priceMinor: 2_000, durationMinutes: 20, kind: "ADDON", category: "Makeup", description: "Hand-placed cluster lashes." },
    { key: "treatment", name: "Deep Conditioning Treatment", priceMinor: 1_500, durationMinutes: 20, kind: "ADDON", category: "Hair", description: "Steam-activated bond treatment." },
    { key: "brows", name: "Brow Shape & Tint", priceMinor: 1_800, durationMinutes: 25, kind: "ADDON", category: "Makeup", description: "Wax, shape and tint." },
  ] as const;

  const services: Record<string, string> = {};
  for (const item of catalogue) {
    const created = await prisma.service.create({
      data: {
        name: item.name,
        description: item.description,
        priceMinor: item.priceMinor,
        durationMinutes: item.durationMinutes,
        kind: item.kind,
        category: item.category,
      },
    });
    services[item.key] = created.id;
  }

  const allServiceIds = Object.values(services);

  // --- Providers -----------------------------------------------------------
  const providerSpecs = [
    { name: "Amara Okafor", email: "amara@glamnet.test", hub: sheffield, rating: 4.9, completed: 214, windows: EXTENDED_WEEK, skills: allServiceIds, bio: "Braids and occasion hair specialist. Takes short-notice work." },
    { name: "Priya Shah", email: "priya@glamnet.test", hub: sheffield, rating: 4.8, completed: 168, windows: STANDARD_WEEK, skills: [services.glam, services.bridal, services.lashes, services.brows], bio: "Bridal and editorial makeup artist." },
    { name: "Chloe Bennett", email: "chloe@glamnet.test", hub: sheffield, rating: 4.6, completed: 92, windows: STANDARD_WEEK, skills: [services.updo, services.blowdry, services.treatment], bio: "Blow dry and updo work across South Sheffield." },
    { name: "Nadia Rahman", email: "nadia@glamnet.test", hub: sheffield, rating: 4.4, completed: 51, windows: EXTENDED_WEEK, skills: [services.gelmani, services.lashes, services.brows], bio: "Nails and brows, evenings and weekends." },
    { name: "Sofia Marino", email: "sofia@glamnet.test", hub: leeds, rating: 4.9, completed: 301, windows: EXTENDED_WEEK, skills: allServiceIds, bio: "Leeds-based all-rounder." },
    { name: "Ines Duarte", email: "ines@glamnet.test", hub: leeds, rating: 4.7, completed: 143, windows: STANDARD_WEEK, skills: [services.braids, services.updo, services.treatment], bio: "Protective styling and natural hair." },
  ];

  const providers: Record<string, string> = {};
  for (const spec of providerSpecs) {
    const created = await prisma.provider.create({
      data: {
        name: spec.name,
        email: spec.email,
        bio: spec.bio,
        rating: spec.rating,
        completedBookings: spec.completed,
        hubId: spec.hub.id,
        // Approved on purpose. approvalStatus defaults to PENDING, and every
        // customer-facing query filters on APPROVED — so a seed that left it
        // at the default produced a database with a full catalogue and
        // nothing bookable in it: empty search, empty storefronts, and a
        // broadcast that could never find a provider.
        approvalStatus: "APPROVED",
        approvedAt: new Date(),
        availability: { create: spec.windows },
        services: { create: spec.skills.map((serviceId) => ({ serviceId })) },
      },
    });
    providers[spec.email] = created.id;
  }

  // --- Customers -----------------------------------------------------------
  const customer = await prisma.customer.create({
    data: { name: "Jade Whitfield", email: "jade@example.test", phone: "07700 900123" },
  });
  await prisma.customer.create({
    data: { name: "Rosie Adeyemi", email: "rosie@example.test", phone: "07700 900456" },
  });

  // --- An existing confirmed booking, so the calendar is not empty ----------
  // Tomorrow 14:00-16:00 (120 min) reserves through 16:15 with the buffer.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0);

  const durationMinutes = 75 + 45; // Prom Updo + Glam Makeup
  const reservedUntil = new Date(tomorrow.getTime() + (durationMinutes + 15) * 60_000);
  const createdAt = new Date(tomorrow.getTime() - 5 * 24 * 60 * 60_000);

  const existing = await prisma.booking.create({
    data: {
      bookingType: "NORMAL",
      bookingCreatedAt: createdAt,
      appointmentStartAt: tomorrow,
      noticePeriodMinutes: Math.trunc((tomorrow.getTime() - createdAt.getTime()) / 60_000),
      thresholdMinutesUsed: 720,
      serviceDurationMinutes: durationMinutes,
      reservedDurationMinutes: durationMinutes + 15,
      reservedUntilAt: reservedUntil,
      subtotalMinor: 14_500,
      travelFeeMinor: 500,
      emergencySurchargeMinor: 0,
      trustFeeMinor: 50,
      totalInvoicePriceMinor: 15_050,
      providerEarningsMinor: 10_650,
      status: "CONFIRMED",
      sector: "S11",
      addressLine: "14 Ecclesall Road, Sheffield",
      customerId: customer.id,
      hubId: sheffield.id,
      providerId: providers["amara@glamnet.test"],
      items: {
        create: [
          { serviceId: services.updo, name: "Prom Updo", priceMinor: 8_000, durationMinutes: 75, kind: "SERVICE" },
          { serviceId: services.glam, name: "Glam Makeup", priceMinor: 6_500, durationMinutes: 45, kind: "SERVICE" },
        ],
      },
    },
  });

  await prisma.bookingStatusEvent.createMany({
    data: [
      { bookingId: existing.id, fromStatus: null, toStatus: "REQUESTED", actor: "CUSTOMER" },
      { bookingId: existing.id, fromStatus: "REQUESTED", toStatus: "BROADCAST", actor: "SYSTEM" },
      { bookingId: existing.id, fromStatus: "BROADCAST", toStatus: "ACCEPTED", actor: "PROVIDER" },
      { bookingId: existing.id, fromStatus: "ACCEPTED", toStatus: "CONFIRMED", actor: "SYSTEM" },
    ],
  });

  console.log(
    `Seeded ${providerSpecs.length} providers, ${catalogue.length} services, 2 hubs, 1 confirmed booking.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
