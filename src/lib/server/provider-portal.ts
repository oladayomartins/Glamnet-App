import { prisma } from "./prisma";
import { BookingError } from "./booking-service";
import { paymentGateway } from "./payments";
import { isValidSlug } from "@/lib/domain/storefront";
import { normaliseSector } from "@/lib/domain/postcode";
import { isTrustedImageUrl } from "@/lib/imagekit";
import { deleteImageKitFiles } from "./imagekit-admin";

/**
 * The Pro Portal (Open Marketplace Directory §C, Flow 3): everything a
 * vendor edits about their own storefront. Every function takes the vendor
 * id from the session — never from a request body — so one vendor can never
 * edit another's page.
 */

export const WORKSPACE_TYPES = ["HOME_SALON", "PRIVATE_ROOM", "CHAIR", "MOBILE"] as const;
export const DOCUMENT_KINDS = ["INSURANCE", "LICENCE", "CERTIFICATE"] as const;
export const MAX_LOOKBOOK_IMAGES = 3;

/** Handles are stored bare, without the @ or a pasted profile URL. */
export function cleanHandle(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\/(www\.)?(instagram\.com|tiktok\.com)\/@?/i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "")
    .slice(0, 40);
}

export async function isSlugAvailable(slug: string, providerId: string): Promise<boolean> {
  if (!isValidSlug(slug)) return false;
  const holder = await prisma.provider.findUnique({ where: { slug }, select: { id: true } });
  return !holder || holder.id === providerId;
}

export async function updateStorefrontProfile(
  providerId: string,
  input: {
    name?: string;
    phone?: string;
    bio?: string;
    slug?: string;
    instagramHandle?: string;
    tiktokHandle?: string;
    workspaceType?: (typeof WORKSPACE_TYPES)[number];
    workspacePostcode?: string;
    travelsToClients?: boolean;
    avatar?: { url: string; fileId: string } | null;
  },
) {
  if (input.avatar && !isTrustedImageUrl(input.avatar.url)) {
    throw new BookingError("Upload the photo through the app.", "INVALID_TRANSITION", 422);
  }
  if (input.slug !== undefined && !(await isSlugAvailable(input.slug, providerId))) {
    throw new BookingError("That link is taken or not allowed. Try another.", "INVALID_TRANSITION", 409);
  }

  let workspaceSector: string | undefined;
  if (input.workspacePostcode !== undefined) {
    if (input.workspacePostcode.trim() === "") {
      workspaceSector = "";
    } else {
      const sector = normaliseSector(input.workspacePostcode);
      if (!sector) {
        throw new BookingError("Enter an S postcode, like S10 or S11 8HN.", "INVALID_TRANSITION", 422);
      }
      workspaceSector = sector;
    }
  }

  if (input.workspaceType === "MOBILE" && input.travelsToClients === false) {
    throw new BookingError(
      "A mobile vendor has to travel to clients, or clients have nowhere to go.",
      "INVALID_TRANSITION",
      422,
    );
  }

  const before =
    input.avatar !== undefined
      ? await prisma.provider.findUnique({ where: { id: providerId }, select: { avatarFileId: true } })
      : null;

  const updated = await prisma.provider.update({
    where: { id: providerId },
    data: {
      ...(input.avatar !== undefined
        ? { avatarUrl: input.avatar?.url ?? "", avatarFileId: input.avatar?.fileId ?? "" }
        : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
      ...(input.bio !== undefined ? { bio: input.bio.trim() } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.instagramHandle !== undefined ? { instagramHandle: cleanHandle(input.instagramHandle) } : {}),
      ...(input.tiktokHandle !== undefined ? { tiktokHandle: cleanHandle(input.tiktokHandle) } : {}),
      ...(input.workspaceType !== undefined ? { workspaceType: input.workspaceType } : {}),
      ...(workspaceSector !== undefined ? { workspaceSector } : {}),
      ...(input.travelsToClients !== undefined ? { travelsToClients: input.travelsToClients } : {}),
    },
  });

  // The replaced photo leaves the library once the new one is saved.
  if (before?.avatarFileId && before.avatarFileId !== (input.avatar?.fileId ?? "")) {
    await deleteImageKitFiles([before.avatarFileId]);
  }
  return updated;
}

/** Replace the vendor's menu: which services, at what price and duration. */
export async function replaceMenu(
  providerId: string,
  items: { serviceId: string; priceMinor?: number | null; durationMinutes?: number | null }[],
) {
  const ids = [...new Set(items.map((item) => item.serviceId))];
  const known = await prisma.service.count({ where: { id: { in: ids }, isActive: true } });
  if (known !== ids.length) {
    throw new BookingError("One or more services are not in the catalogue.", "UNKNOWN_SERVICE");
  }
  await prisma.$transaction([
    prisma.providerService.deleteMany({ where: { providerId } }),
    prisma.providerService.createMany({
      data: items.map((item) => ({
        providerId,
        serviceId: item.serviceId,
        priceMinor: item.priceMinor ?? null,
        durationMinutes: item.durationMinutes ?? null,
      })),
    }),
  ]);
}

export async function replaceLookbook(
  providerId: string,
  images: { url: string; fileId: string; caption: string }[],
) {
  if (images.length > MAX_LOOKBOOK_IMAGES) {
    throw new BookingError(`Up to ${MAX_LOOKBOOK_IMAGES} looks.`, "INVALID_TRANSITION", 422);
  }
  const previous = await prisma.providerLookbookImage.findMany({
    where: { providerId },
    select: { fileId: true },
  });
  await prisma.$transaction([
    prisma.providerLookbookImage.deleteMany({ where: { providerId } }),
    prisma.providerLookbookImage.createMany({
      data: images.map((image, position) => ({ providerId, ...image, position })),
    }),
  ]);
  // Looks that were swapped out or removed leave the media library too.
  const kept = new Set(images.map((image) => image.fileId));
  await deleteImageKitFiles(previous.map((image) => image.fileId).filter((id) => !kept.has(id)));
}

export async function addDocument(
  providerId: string,
  input: {
    kind: (typeof DOCUMENT_KINDS)[number];
    url: string;
    fileId: string;
    fileName: string;
    mimeType: string;
  },
) {
  return prisma.providerDocument.create({ data: { providerId, ...input } });
}

export async function removeDocument(providerId: string, documentId: string) {
  // Approved documents are the record the vendor was verified against.
  const result = await prisma.providerDocument.deleteMany({
    where: { id: documentId, providerId, status: { not: "APPROVED" } },
  });
  if (result.count === 0) {
    throw new BookingError("That document cannot be removed.", "NOT_FOUND", 404);
  }
}

/**
 * Start (or resume) Stripe Connect Express onboarding and return the URL to
 * send the vendor to. On the simulated gateway this marks payouts ready and
 * returns straight to the portal.
 */
export async function startPayoutOnboarding(providerId: string, origin: string) {
  const provider = await prisma.provider.findUniqueOrThrow({ where: { id: providerId } });
  const gateway = paymentGateway();

  let accountId = provider.stripeAccountId;
  if (!accountId) {
    const created = await gateway.createConnectedAccount({ email: provider.email, providerId });
    // Claim only if still unset: a double-click can race two creations, and
    // the vendor must end up with one account that every later link reuses.
    const claimed = await prisma.provider.updateMany({
      where: { id: providerId, stripeAccountId: "" },
      data: { stripeAccountId: created },
    });
    accountId = claimed.count === 1
      ? created
      : (await prisma.provider.findUniqueOrThrow({ where: { id: providerId } })).stripeAccountId;
  }

  return gateway.createOnboardingLink({
    accountId,
    refreshUrl: `${origin}/api/provider/payouts`,
    returnUrl: `${origin}/api/provider/payouts/return`,
  });
}

/** Re-read payout readiness from the gateway after onboarding returns. */
export async function refreshPayoutStatus(providerId: string) {
  const provider = await prisma.provider.findUniqueOrThrow({ where: { id: providerId } });
  if (!provider.stripeAccountId) return false;
  const enabled = await paymentGateway().payoutsEnabled(provider.stripeAccountId);
  await prisma.provider.update({ where: { id: providerId }, data: { payoutsEnabled: enabled } });
  return enabled;
}

/** What the wizard still needs before the application can be submitted. */
export async function onboardingGaps(providerId: string): Promise<string[]> {
  const provider = await prisma.provider.findUniqueOrThrow({
    where: { id: providerId },
    include: { _count: { select: { services: true, documents: true } } },
  });
  const gaps: string[] = [];
  if (!provider.slug) gaps.push("Choose your storefront link.");
  if (provider.bio.trim().length < 20) gaps.push("Write a short bio (20 characters or more).");
  if (provider.workspaceType !== "MOBILE" && !provider.workspaceSector) {
    gaps.push("Add your workspace postcode.");
  }
  if (provider._count.services === 0) gaps.push("Add at least one service to your menu.");
  if (provider._count.documents === 0) gaps.push("Upload your insurance certificate or licence.");
  // A linked bank is not needed to submit: it is needed to be *paid*, and
  // releasing a payment already refuses without one. Requiring it here left
  // pros stuck whenever bank linking itself was unavailable.
  return gaps;
}

export async function completeOnboarding(providerId: string) {
  const gaps = await onboardingGaps(providerId);
  if (gaps.length > 0) {
    throw new BookingError(gaps.join(" "), "INVALID_TRANSITION", 422);
  }
  return prisma.provider.update({
    where: { id: providerId },
    data: { onboardedAt: new Date() },
  });
}

/** Pause or resume new bookings — the vacation toggle. */
export async function setAcceptingWork(providerId: string, accepting: boolean) {
  const provider = await prisma.provider.findUniqueOrThrow({ where: { id: providerId } });
  if (accepting && provider.approvalStatus !== "APPROVED") {
    throw new BookingError("Your account has not been approved yet.", "INVALID_TRANSITION", 409);
  }
  return prisma.provider.update({ where: { id: providerId }, data: { isAcceptingWork: accepting } });
}
