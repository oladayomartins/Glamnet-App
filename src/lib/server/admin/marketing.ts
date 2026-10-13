import { z } from "zod";
import { patchSchema } from "@/lib/api/patch-schema";
import { prisma } from "../prisma";
import { sendEmails } from "../email";
import { deleteImageKitFiles } from "../imagekit-admin";
import { campaignEmail } from "@/lib/email/templates";
import { siteUrl } from "@/lib/site";
import { oneClickUrl, unsubscribeUrl } from "../unsubscribe";
import {
  AD_ALIGN_KEYS,
  AD_DEVICE_KEYS,
  AD_FIT_KEYS,
  AD_HEIGHT,
  AD_LIST_POSITION,
  AD_SIZE_KEYS,
  AD_SLOT_KEYS,
  AD_TEXT_POSITION_KEYS,
  AD_WIDTH,
  sizeDimensions,
  type AdAlign,
  type AdDevice,
  type AdFit,
  type AdSize,
  type AdSlot,
  type AdTextPosition,
} from "@/lib/domain/ad-layout";
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
  const { startsAt, endsAt, ctaUrl, ...rest } = patchSchema(campaignInput).parse(raw);
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

/**
 * Everyone a campaign should reach by email: not suspended, and not opted
 * out of marketing. Each comes with their own unsubscribe token.
 */
export async function campaignRecipients(audience: Audience): Promise<Array<{ email: string; token: string }>> {
  const roles = audience === "CUSTOMERS" ? ["CUSTOMER"] : audience === "VENDORS" ? ["PROVIDER"] : ["CUSTOMER", "PROVIDER"];
  return prisma.appUser.findMany({
    where: { role: { in: roles }, suspendedAt: null, marketingOptOutAt: null },
    select: { email: true, unsubscribeToken: true },
  }).then((users) => users.map((user) => ({ email: user.email, token: user.unsubscribeToken })));
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
  const cta = campaign.ctaLabel && ctaUrl ? { label: campaign.ctaLabel, url: ctaUrl } : undefined;
  // One message per person: each carries their own unsubscribe link.
  const result = await sendEmails(
    recipients.map((recipient) => ({
      to: recipient.email,
      ...campaignEmail({
        title: campaign.title,
        message: campaign.message,
        cta,
        unsubscribeUrl: unsubscribeUrl(recipient.token),
        oneClickUrl: oneClickUrl(recipient.token),
      }),
    })),
  );

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

export { AD_SLOTS, type AdSlot } from "@/lib/domain/ad-layout";

const adInput = z.object({
  slot: z.enum(AD_SLOT_KEYS),
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
  size: z.enum(AD_SIZE_KEYS).default("BANNER"),
  width: z.number().int().min(AD_WIDTH.min).max(AD_WIDTH.max).default(1400),
  height: z.number().int().min(AD_HEIGHT.min).max(AD_HEIGHT.max).default(400),
  align: z.enum(AD_ALIGN_KEYS).default("CENTER"),
  textPosition: z.enum(AD_TEXT_POSITION_KEYS).default("BOTTOM_LEFT"),
  imageFit: z.enum(AD_FIT_KEYS).default("COVER"),
  device: z.enum(AD_DEVICE_KEYS).default("ALL"),
  listPosition: z.number().int().min(AD_LIST_POSITION.min).max(AD_LIST_POSITION.max).default(4),
  targetCity: z.string().trim().max(80).default(""),
});

/**
 * A preset size always stores the preset's dimensions, whatever the request
 * said, so the stored width and height are the ones the site draws.
 */
function withDimensions<T extends { size?: AdSize; width?: number; height?: number }>(
  input: T,
  current?: { size: string; width: number; height: number },
): T {
  const size = input.size ?? (current?.size as AdSize | undefined);
  if (!size) return input;
  const { width, height } = sizeDimensions(size, {
    width: input.width ?? current?.width ?? 1400,
    height: input.height ?? current?.height ?? 400,
  });
  return { ...input, size, width, height };
}

/** A headline hidden over an image is fine; hidden over nothing is a blank box. */
function checkVisible(textPosition: string, imageUrl: string) {
  if (textPosition === "HIDDEN" && !imageUrl) {
    throw new AdminError("Add a banner image, or show the headline: an ad with neither would be an empty box.", 422);
  }
}

export async function createAd(actorEmail: string, raw: unknown) {
  const { startsAt, endsAt, linkUrl, ...rest } = withDimensions(adInput.parse(raw));
  checkWindow(startsAt, endsAt);
  checkVisible(rest.textPosition, rest.imageUrl);
  const ad = await prisma.adPlacement.create({
    data: { ...rest, linkUrl: safeLink(linkUrl), ...(startsAt ? { startsAt } : {}), endsAt: endsAt ?? null },
  });
  await audit(actorEmail, "ad.create", { type: "AdPlacement", id: ad.id }, `${ad.title} (${ad.slot}, ${ad.width}×${ad.height})`);
  return ad;
}

export async function updateAd(actorEmail: string, id: string, raw: unknown) {
  const current = await prisma.adPlacement.findUnique({ where: { id } });
  if (!current) throw new AdminError("That ad no longer exists.", 404, "NOT_FOUND");
  const parsed = patchSchema(adInput).parse(raw);
  const { startsAt, endsAt, linkUrl, ...rest } =
    parsed.size !== undefined || parsed.width !== undefined || parsed.height !== undefined
      ? withDimensions(parsed, current)
      : parsed;
  checkWindow(startsAt ?? current.startsAt, endsAt === undefined ? current.endsAt : endsAt);
  checkVisible(rest.textPosition ?? current.textPosition, rest.imageUrl ?? current.imageUrl);
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
  const action =
    rest.isActive === true && !current.isActive
      ? "ad.activate"
      : rest.isActive === false && current.isActive
        ? "ad.pause"
        : "ad.update";
  await audit(actorEmail, action, { type: "AdPlacement", id }, ad.title);
  return ad;
}

/** A copy of an ad, paused, for running a variant or the same ad in another slot. */
export async function duplicateAd(actorEmail: string, id: string) {
  const current = await prisma.adPlacement.findUnique({ where: { id } });
  if (!current) throw new AdminError("That ad no longer exists.", 404, "NOT_FOUND");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropped on purpose
  const { id: _id, createdAt, updatedAt, impressions, clicks, imageFileId, ...copy } = current;
  const ad = await prisma.adPlacement.create({
    // The image file stays owned by the original: deleting either ad must not
    // delete the other's picture, so the copy shares the URL but not the file id.
    data: { ...copy, title: `${current.title} (copy)`.slice(0, 80), isActive: false, imageFileId: "" },
  });
  await audit(actorEmail, "ad.duplicate", { type: "AdPlacement", id: ad.id }, `${ad.title} from ${id}`);
  return ad;
}

export async function deleteAd(actorEmail: string, id: string) {
  const current = await prisma.adPlacement.findUnique({ where: { id } });
  if (!current) throw new AdminError("That ad no longer exists.", 404, "NOT_FOUND");
  await prisma.adPlacement.delete({ where: { id } });
  if (current.imageFileId) {
    // A duplicate may still be showing this picture.
    const shared = await prisma.adPlacement.count({ where: { imageUrl: current.imageUrl } });
    if (shared === 0) await deleteImageKitFiles([current.imageFileId]);
  }
  await audit(actorEmail, "ad.delete", { type: "AdPlacement", id }, current.title);
}

export interface LiveAd {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  hasLink: boolean;
  width: number;
  height: number;
  align: AdAlign;
  textPosition: AdTextPosition;
  imageFit: AdFit;
  device: AdDevice;
  listPosition: number;
}

/**
 * What to show in a slot right now: one ad for phones and one for computers,
 * which are usually the same ad. Ads aimed at one kind of device compete only
 * there, so a computers-only ad never leaves phones with an empty slot.
 *
 * Views are not counted here: the ad counts itself once it is actually on
 * screen (see AdView), which keeps a write off every page render and means an
 * ad hidden on this device is not counted as seen.
 *
 * Never throws: an ad slot is decoration, not a reason for a page to fail.
 */
export async function adsForSlot(slot: AdSlot, options: { city?: string | null } = {}): Promise<LiveAd[]> {
  try {
    const now = new Date();
    const city = options.city?.trim() ?? "";
    const rows = await prisma.adPlacement.findMany({
      where: {
        slot,
        isActive: true,
        startsAt: { lte: now },
        AND: [
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
          { OR: [{ targetCity: "" }, ...(city ? [{ targetCity: { equals: city, mode: "insensitive" as const } }] : [])] },
        ],
      },
      // Fewest views first rotates ads of equal priority. A city's own ad
      // beats a nationwide one at the same priority.
      orderBy: [{ priority: "desc" }, { impressions: "asc" }],
      take: 20,
    });
    const live = rows
      .filter((ad) => isLive(ad, now))
      .sort((a, b) => b.priority - a.priority || Number(Boolean(b.targetCity)) - Number(Boolean(a.targetCity)));
    const mobile = live.find((ad) => ad.device !== "DESKTOP");
    const desktop = live.find((ad) => ad.device !== "MOBILE");
    const picked = mobile && desktop && mobile.id === desktop.id ? [{ ...mobile, device: "ALL" }] : [
      ...(mobile ? [{ ...mobile, device: desktop ? "MOBILE" : mobile.device }] : []),
      ...(desktop ? [{ ...desktop, device: mobile ? "DESKTOP" : desktop.device }] : []),
    ];
    return picked.map((ad) => ({
      id: ad.id,
      title: ad.title,
      subtitle: ad.subtitle,
      imageUrl: ad.imageUrl,
      hasLink: Boolean(ad.linkUrl),
      width: ad.width,
      height: ad.height,
      align: ad.align as AdAlign,
      textPosition: ad.textPosition as AdTextPosition,
      imageFit: ad.imageFit as AdFit,
      device: ad.device as AdDevice,
      listPosition: ad.listPosition,
    }));
  } catch (cause) {
    console.error("[ads] slot lookup failed", cause);
    return [];
  }
}
