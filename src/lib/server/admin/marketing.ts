import { z } from "zod";
import { prisma } from "../prisma";
import { sendEmails } from "../email";
import { deleteImageKitFiles } from "../imagekit-admin";
import { campaignEmail } from "@/lib/email/templates";
import { siteUrl } from "@/lib/site";
import { AdminError, audit, isLive, safeLink } from "./core";

/**
 * Campaigns (site banners and email) and ad placements.
 */

const dateField = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: "custom", message: "Not a valid date." });
      return z.NEVER;
    }
    return date;
  });

// --- Campaigns ----------------------------------------------------------------

export const AUDIENCES = ["ALL", "CUSTOMERS", "VENDORS"] as const;
export type Audience = (typeof AUDIENCES)[number];

const campaignInput = z.object({
  name: z.string().trim().min(2).max(80),
  audience: z.enum(AUDIENCES).default("ALL"),
  title: z.string().trim().min(2).max(120),
  message: z.string().trim().min(2).max(4000),
  ctaLabel: z.string().trim().max(40).default(""),
  ctaUrl: z.string().trim().max(500).default(""),
  showBanner: z.boolean().default(true),
  startsAt: dateField,
  endsAt: dateField,
  isActive: z.boolean().default(false),
});

function checkWindow(startsAt?: Date | null, endsAt?: Date | null) {
  if (startsAt && endsAt && endsAt <= startsAt) {
    throw new AdminError("The end date must be after the start date.", 422);
  }
}

export async function createCampaign(actorEmail: string, raw: unknown) {
  const { startsAt, endsAt, ctaUrl, ...rest } = campaignInput.parse(raw);
  checkWindow(startsAt, endsAt);
  const campaign = await prisma.campaign.create({
    data: {
      ...rest,
      ctaUrl: safeLink(ctaUrl),
      ...(startsAt ? { startsAt } : {}),
      endsAt: endsAt ?? null,
      createdBy: actorEmail,
    },
  });
  await audit(actorEmail, "campaign.create", { type: "Campaign", id: campaign.id }, campaign.name);
  return campaign;
}

export async function updateCampaign(actorEmail: string, id: string, raw: unknown) {
  const { startsAt, endsAt, ctaUrl, ...rest } = campaignInput.partial().parse(raw);
  const current = await prisma.campaign.findUnique({ where: { id } });
  if (!current) throw new AdminError("That campaign no longer exists.", 404, "NOT_FOUND");
  checkWindow(startsAt ?? current.startsAt, endsAt === undefined ? current.endsAt : endsAt);
  const campaign = await prisma.campaign.update({
    where: { id },
    data: {
      ...rest,
      ...(ctaUrl !== undefined ? { ctaUrl: safeLink(ctaUrl) } : {}),
      ...(startsAt ? { startsAt } : {}),
      ...(endsAt !== undefined ? { endsAt } : {}),
    },
  });
  const action =
    rest.isActive === true && !current.isActive
      ? "campaign.activate"
      : rest.isActive === false && current.isActive
        ? "campaign.pause"
        : "campaign.update";
  await audit(actorEmail, action, { type: "Campaign", id }, campaign.name);
  return campaign;
}

export async function deleteCampaign(actorEmail: string, id: string) {
  const current = await prisma.campaign.findUnique({ where: { id } });
  if (!current) throw new AdminError("That campaign no longer exists.", 404, "NOT_FOUND");
  await prisma.campaign.delete({ where: { id } });
  await audit(actorEmail, "campaign.delete", { type: "Campaign", id }, current.name);
}

/** Everyone a campaign should reach by email, excluding suspended accounts. */
export async function campaignRecipients(audience: Audience): Promise<string[]> {
  const roles = audience === "CUSTOMERS" ? ["CUSTOMER"] : audience === "VENDORS" ? ["PROVIDER"] : ["CUSTOMER", "PROVIDER"];
  const users = await prisma.appUser.findMany({
    where: { role: { in: roles }, suspendedAt: null },
    select: { email: true },
  });
  return [...new Set(users.map((user) => user.email))];
}

/**
 * Email a campaign to its audience. Sent once: a second press would mail
 * every customer twice, which is the one mistake a campaign tool must not
 * make easy.
 */
export async function sendCampaignEmail(actorEmail: string, id: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) throw new AdminError("That campaign no longer exists.", 404, "NOT_FOUND");
  if (campaign.emailSentAt) throw new AdminError("This campaign has already been emailed.");

  // Claim the send before doing it, so two clicks cannot both go out.
  const claimed = await prisma.campaign.updateMany({
    where: { id, emailSentAt: null },
    data: { emailSentAt: new Date() },
  });
  if (claimed.count === 0) throw new AdminError("This campaign has already been emailed.");

  const recipients = await campaignRecipients(campaign.audience as Audience);
  const ctaUrl = campaign.ctaUrl.startsWith("/") ? `${siteUrl()}${campaign.ctaUrl}` : campaign.ctaUrl;
  const body = campaignEmail({
    title: campaign.title,
    message: campaign.message,
    cta: campaign.ctaLabel && ctaUrl ? { label: campaign.ctaLabel, url: ctaUrl } : undefined,
  });
  const result = await sendEmails(recipients.map((to) => ({ to, ...body })));

  if (!result.ok) {
    // Nothing went out: release the claim so it can be retried.
    await prisma.campaign.update({ where: { id }, data: { emailSentAt: null } });
    const reason =
      result.reason === "NOT_CONFIGURED"
        ? "Email sending is not set up (RESEND_API_KEY is missing)."
        : result.reason === "NO_RECIPIENTS"
          ? "Nobody in this audience has an account yet."
          : "The email service refused the send. Try again shortly.";
    throw new AdminError(reason, 503, "EMAIL_FAILED");
  }

  await prisma.campaign.update({ where: { id }, data: { emailSentTo: result.sent } });
  await audit(actorEmail, "campaign.email", { type: "Campaign", id }, `${campaign.name} → ${result.sent} recipients`);
  return result.sent;
}

export interface LiveCampaign {
  id: string;
  title: string;
  message: string;
  ctaLabel: string;
  ctaUrl: string;
}

/** Banners currently live for a viewer. Never throws: a banner is optional. */
export async function liveBanners(viewer: "CUSTOMER" | "PROVIDER" | "ADMIN" | null): Promise<LiveCampaign[]> {
  try {
    const now = new Date();
    const audiences: Audience[] =
      viewer === "PROVIDER" ? ["ALL", "VENDORS"] : viewer === "ADMIN" ? ["ALL", "CUSTOMERS", "VENDORS"] : ["ALL", "CUSTOMERS"];
    const rows = await prisma.campaign.findMany({
      where: {
        isActive: true,
        showBanner: true,
        audience: { in: audiences },
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      orderBy: { startsAt: "desc" },
      take: 1,
    });
    return rows.map(({ id, title, message, ctaLabel, ctaUrl }) => ({ id, title, message, ctaLabel, ctaUrl }));
  } catch (cause) {
    console.error("[campaigns] banner lookup failed", cause);
    return [];
  }
}

// --- Ad placements --------------------------------------------------------------

export const AD_SLOTS = {
  HOME_BANNER: { label: "Home page banner", hint: "Wide banner under the home page hero" },
  DIRECTORY_TOP: { label: "Directory — top", hint: "Above the vendor list on /[city]/salons" },
  STOREFRONT_FOOTER: { label: "Storefront footer", hint: "Under the reviews on every /pro page" },
} as const;
export type AdSlot = keyof typeof AD_SLOTS;

const adInput = z.object({
  slot: z.enum(Object.keys(AD_SLOTS) as [AdSlot, ...AdSlot[]]),
  title: z.string().trim().min(2).max(80),
  subtitle: z.string().trim().max(160).default(""),
  imageUrl: z.string().trim().max(500).default(""),
  imageFileId: z.string().trim().max(200).default(""),
  linkUrl: z.string().trim().max(500).default(""),
  advertiser: z.string().trim().max(80).default(""),
  startsAt: dateField,
  endsAt: dateField,
  isActive: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(0),
});

export async function createAd(actorEmail: string, raw: unknown) {
  const { startsAt, endsAt, linkUrl, ...rest } = adInput.parse(raw);
  checkWindow(startsAt, endsAt);
  const ad = await prisma.adPlacement.create({
    data: { ...rest, linkUrl: safeLink(linkUrl), ...(startsAt ? { startsAt } : {}), endsAt: endsAt ?? null },
  });
  await audit(actorEmail, "ad.create", { type: "AdPlacement", id: ad.id }, `${ad.title} (${ad.slot})`);
  return ad;
}

export async function updateAd(actorEmail: string, id: string, raw: unknown) {
  const { startsAt, endsAt, linkUrl, ...rest } = adInput.partial().parse(raw);
  const current = await prisma.adPlacement.findUnique({ where: { id } });
  if (!current) throw new AdminError("That ad no longer exists.", 404, "NOT_FOUND");
  checkWindow(startsAt ?? current.startsAt, endsAt === undefined ? current.endsAt : endsAt);
  const ad = await prisma.adPlacement.update({
    where: { id },
    data: {
      ...rest,
      ...(linkUrl !== undefined ? { linkUrl: safeLink(linkUrl) } : {}),
      ...(startsAt ? { startsAt } : {}),
      ...(endsAt !== undefined ? { endsAt } : {}),
    },
  });
  if (rest.imageFileId !== undefined && current.imageFileId && current.imageFileId !== rest.imageFileId) {
    await deleteImageKitFiles([current.imageFileId]);
  }
  await audit(actorEmail, "ad.update", { type: "AdPlacement", id }, ad.title);
  return ad;
}

export async function deleteAd(actorEmail: string, id: string) {
  const current = await prisma.adPlacement.findUnique({ where: { id } });
  if (!current) throw new AdminError("That ad no longer exists.", 404, "NOT_FOUND");
  await prisma.adPlacement.delete({ where: { id } });
  if (current.imageFileId) await deleteImageKitFiles([current.imageFileId]);
  await audit(actorEmail, "ad.delete", { type: "AdPlacement", id }, current.title);
}

export interface LiveAd {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  hasLink: boolean;
}

/**
 * The ad to show in a slot right now, counting the impression.
 * Never throws: an ad slot is decoration, not a reason for a page to fail.
 */
export async function adForSlot(slot: AdSlot): Promise<LiveAd | null> {
  try {
    const now = new Date();
    const ad = await prisma.adPlacement.findFirst({
      where: {
        slot,
        isActive: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      orderBy: [{ priority: "desc" }, { impressions: "asc" }],
    });
    if (!ad || !isLive(ad, now)) return null;
    // Ordering by fewest impressions rotates ads of equal priority.
    await prisma.adPlacement.update({ where: { id: ad.id }, data: { impressions: { increment: 1 } } });
    return { id: ad.id, title: ad.title, subtitle: ad.subtitle, imageUrl: ad.imageUrl, hasLink: Boolean(ad.linkUrl) };
  } catch (cause) {
    console.error("[ads] slot lookup failed", cause);
    return null;
  }
}
