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
  await prisma.bookingCompletionPhoto.deleteMany();
  await prisma.providerLookbookImage.deleteMany();
  await prisma.providerDocument.deleteMany();
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
  // Categories are the five Specialty Hubs of the marketplace directory
  // (src/lib/domain/specialty-hubs.ts) — the names must match exactly.
  const AFRO = "Afro & Textured";
  const EURO = "European & Western";
  const MUA = "MUA Glam & Asian Bridal";
  const NAILS = "Manicures & Pedicures";
  const MASSAGE = "Massage & Wellness";
  const catalogue = [
    { key: "braids", name: "Knotless Braids", priceMinor: 12_000, durationMinutes: 180, kind: "SERVICE", category: AFRO, description: "Full head knotless braids, medium size." },
    { key: "twists", name: "Passion Twists", priceMinor: 9_500, durationMinutes: 150, kind: "SERVICE", category: AFRO, description: "Protective twists, bum length." },
    { key: "blowdry", name: "Luxury Blow Dry", priceMinor: 4_500, durationMinutes: 45, kind: "SERVICE", category: EURO, description: "Wash, treatment and smooth blow dry." },
    { key: "updo", name: "Technical Updo", priceMinor: 8_000, durationMinutes: 75, kind: "SERVICE", category: EURO, description: "Sculpted occasion updo with finishing spray." },
    { key: "glam", name: "Glam Makeup", priceMinor: 6_500, durationMinutes: 45, kind: "SERVICE", category: MUA, description: "Full glam with long-wear base." },
    { key: "bridal", name: "Asian Bridal Makeup", priceMinor: 15_000, durationMinutes: 90, kind: "SERVICE", category: MUA, description: "Bridal makeup with trial notes applied." },
    { key: "gele", name: "Gele Tie", priceMinor: 3_000, durationMinutes: 20, kind: "SERVICE", category: MUA, description: "Traditional gele, tied to the outfit." },
    { key: "biab", name: "BIAB Dry Overlay", priceMinor: 3_800, durationMinutes: 50, kind: "SERVICE", category: NAILS, description: "Builder gel overlay, dry manicure." },
    { key: "gelmani", name: "Gel Manicure", priceMinor: 3_500, durationMinutes: 60, kind: "SERVICE", category: NAILS, description: "Shape, cuticle work and gel colour." },
    { key: "removal", name: "Gel Removal", priceMinor: 1_000, durationMinutes: 20, kind: "ADDON", category: NAILS, description: "Safe soak-off of old gel." },
    { key: "deeptissue", name: "Deep Tissue Massage", priceMinor: 6_000, durationMinutes: 60, kind: "SERVICE", category: MASSAGE, description: "Full body therapeutic deep tissue." },
    { key: "sports", name: "Sports Massage", priceMinor: 5_500, durationMinutes: 45, kind: "SERVICE", category: MASSAGE, description: "Targeted sports and recovery massage." },
    { key: "lashes", name: "Cluster Lashes", priceMinor: 2_000, durationMinutes: 20, kind: "ADDON", category: MUA, description: "Hand-placed cluster lashes." },
    { key: "treatment", name: "Deep Conditioning Treatment", priceMinor: 1_500, durationMinutes: 20, kind: "ADDON", category: AFRO, description: "Steam-activated bond treatment." },
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
    { name: "Amara Okafor", slug: "amara-braids", email: "amara@glamnet.test", hub: sheffield, rating: 4.9, completed: 214, windows: EXTENDED_WEEK, skills: [services.braids, services.twists, services.treatment, services.gele], workspaceType: "HOME_SALON", workspaceSector: "S11", instagram: "amarabraids", bio: "Braids and protective styling from my S11 home salon. Takes short-notice work." },
    { name: "Priya Shah", slug: "priya-bridal", email: "priya@glamnet.test", hub: sheffield, rating: 4.8, completed: 168, windows: STANDARD_WEEK, skills: [services.glam, services.bridal, services.gele, services.lashes], workspaceType: "PRIVATE_ROOM", workspaceSector: "S10", instagram: "priyashahmua", bio: "Asian bridal and editorial makeup artist." },
    { name: "Chloe Bennett", slug: "chloe-blowdry", email: "chloe@glamnet.test", hub: sheffield, rating: 4.6, completed: 92, windows: STANDARD_WEEK, skills: [services.updo, services.blowdry, services.treatment], workspaceType: "CHAIR", workspaceSector: "S1", instagram: "", bio: "Blow dries and technical updos from a city-centre chair." },
    { name: "Nadia Rahman", slug: "nadia-nails", email: "nadia@glamnet.test", hub: sheffield, rating: 4.4, completed: 51, windows: EXTENDED_WEEK, skills: [services.biab, services.gelmani, services.removal], workspaceType: "HOME_SALON", workspaceSector: "S7", instagram: "nadianails", bio: "BIAB and gel nails, evenings and weekends." },
    { name: "Tom Hughes", slug: "tom-sports-massage", email: "tom@glamnet.test", hub: sheffield, rating: 4.7, completed: 77, windows: STANDARD_WEEK, skills: [services.deeptissue, services.sports], workspaceType: "PRIVATE_ROOM", workspaceSector: "S6", instagram: "", bio: "Sports and deep tissue massage therapist." },
    { name: "Sofia Marino", slug: "sofia-leeds", email: "sofia@glamnet.test", hub: leeds, rating: 4.9, completed: 301, windows: EXTENDED_WEEK, skills: allServiceIds, workspaceType: "MOBILE", workspaceSector: "", instagram: "", bio: "Leeds-based all-rounder." },
    { name: "Ines Duarte", slug: "ines-natural-hair", email: "ines@glamnet.test", hub: leeds, rating: 4.7, completed: 143, windows: STANDARD_WEEK, skills: [services.braids, services.updo, services.treatment], workspaceType: "MOBILE", workspaceSector: "", instagram: "", bio: "Protective styling and natural hair." },
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
        // Seeded vendors are already vetted, so their storefronts are live.
        approvalStatus: "APPROVED",
        approvedAt: new Date(),
        isVerified: true,
        onboardedAt: new Date(),
        slug: spec.slug,
        workspaceType: spec.workspaceType,
        workspaceSector: spec.workspaceSector,
        instagramHandle: spec.instagram,
        documents: {
          create: {
            kind: "INSURANCE",
            fileName: "public-liability-insurance.pdf",
            mimeType: "application/pdf",
            url: "https://ik.imagekit.io/glamnetapp/seed/insurance.pdf",
            status: "APPROVED",
            reviewedAt: new Date(),
          },
        },
        availability: { create: spec.windows },
        services: { create: spec.skills.map((serviceId) => ({ serviceId })) },
      },
    });
    providers[spec.email] = created.id;
  }

  // Storefront menus can differ from the catalogue: a vendor sets their own
  // price and time on their own link.
  await prisma.providerService.update({
    where: { providerId_serviceId: { providerId: providers["amara@glamnet.test"], serviceId: services.braids } },
    data: { priceMinor: 11_000, durationMinutes: 200 },
  });
  await prisma.providerService.update({
    where: { providerId_serviceId: { providerId: providers["priya@glamnet.test"], serviceId: services.bridal } },
    data: { priceMinor: 18_000 },
  });

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

  const durationMinutes = 75 + 45; // Technical Updo + Luxury Blow Dry
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
      subtotalMinor: 12_500,
      travelFeeMinor: 500,
      emergencySurchargeMinor: 0,
      trustFeeMinor: 50,
      totalInvoicePriceMinor: 13_050,
      // Rule B (first discovery booking): 70% of the work + travel.
      providerEarningsMinor: 9_250,
      providerPayoutMinor: 9_250,
      platformCommissionMinor: 3_750,
      commissionBps: 3_000,
      firstDiscoveryBooking: true,
      status: "CONFIRMED",
      sector: "S11",
      addressLine: "14 Ecclesall Road, Sheffield",
      customerId: customer.id,
      hubId: sheffield.id,
      providerId: providers["chloe@glamnet.test"],
      items: {
        create: [
          { serviceId: services.updo, name: "Technical Updo", priceMinor: 8_000, durationMinutes: 75, kind: "SERVICE" },
          { serviceId: services.blowdry, name: "Luxury Blow Dry", priceMinor: 4_500, durationMinutes: 45, kind: "SERVICE" },
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
