import { z } from "zod";
import { parseQueryDate } from "./parse-date";

/**
 * Note what is absent from every schema below: `bookingType`, any price, and
 * any duration. The client supplies intent only — the server derives the
 * classification and the money (spec §9, §12).
 */

const isoDateTime = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Must be an ISO 8601 date-time.",
  })
  .transform((value) => new Date(value));

export const quoteSchema = z.object({
  hubId: z.string().min(1),
  serviceIds: z.array(z.string().min(1)).min(1, "Select at least one service."),
  appointmentStartAt: isoDateTime,
});

export const createBookingSchema = quoteSchema.extend({
  customerId: z.string().min(1),
  addressLine: z.string().max(300).optional(),
  notes: z.string().max(2_000).optional(),
  referenceImageUrl: z.string().max(2_000).optional(),
  referenceImageFileId: z.string().max(200).optional(),
});

export const availabilitySchema = z.object({
  hubId: z.string().min(1),
  serviceIds: z.array(z.string().min(1)).min(1),
  date: isoDateTime,
});

export const acceptSchema = z.object({
  providerId: z.string().min(1),
});

export const transitionSchema = z.object({
  status: z.string().min(1),
  actor: z.string().min(1).default("SYSTEM"),
  note: z.string().max(1_000).optional(),
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  /// Optional written review. Capped so a single field cannot be used to
  /// stuff the booking row with arbitrary text.
  note: z.string().max(2_000).optional(),
});

export const emergencyConfigSchema = z.object({
  thresholdMinutes: z.number().int().min(15).max(10_080),
  surchargeType: z.enum(["PERCENTAGE", "FIXED"]),
  /** Basis points when PERCENTAGE (2500 = 25%), pence when FIXED. */
  surchargeValue: z.number().int().min(0).max(1_000_000),
  effectiveFrom: isoDateTime.optional(),
  isActive: z.boolean().default(true),
  note: z.string().max(500).optional(),
});

const uploadedFile = z.object({
  url: z.string().url().max(2_000),
  fileId: z.string().max(200).default(""),
});

export const checkoutReleaseSchema = z.object({
  photos: z.array(uploadedFile).length(3, "Upload exactly 3 photos."),
});

export const releaseSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, "Enter the 4-digit PIN."),
});

export const disputeSchema = z.object({
  reason: z.string().trim().min(10, "Tell us what went wrong.").max(2_000),
});

export const storefrontCheckoutSchema = z.object({
  serviceIds: z.array(z.string().min(1)).min(1, "Select at least one service."),
  appointmentStartAt: isoDateTime,
  source: z.enum(["MARKETPLACE", "DIRECT_LINK"]),
  serviceLocation: z.enum(["CUSTOMER_ADDRESS", "VENDOR_PREMISES"]),
  tipMinor: z.number().int().min(0).max(50_000).default(0),
  addressLine: z.string().max(300).optional(),
  notes: z.string().max(2_000).optional(),
  promoCode: z.string().trim().max(40).optional(),
});

/**
 * A calendar day. "YYYY-MM-DD" is read as that date on the server, the way
 * the vendor calendar reads it. A full timestamp is still accepted, but it
 * names an instant, not a day: the browser's midnight in British Summer Time
 * is 23:00 the day before in UTC, which once made the storefront show
 * Friday's hours for a Saturday.
 */
const calendarDay = z.string().transform((value, context) => {
  const parsed = parseQueryDate(value);
  if (!parsed) {
    context.addIssue({ code: "custom", message: "Must be a date (YYYY-MM-DD)." });
    return z.NEVER;
  }
  return parsed;
});

export const storefrontSlotsSchema = z.object({
  serviceIds: z.array(z.string().min(1)).min(1),
  date: calendarDay,
});

export const storefrontDaysSchema = z.object({
  serviceIds: z.array(z.string().min(1)).min(1),
  from: calendarDay.optional(),
});

export const storefrontProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(30).optional(),
  bio: z.string().max(1_000).optional(),
  slug: z.string().trim().toLowerCase().max(40).optional(),
  instagramHandle: z.string().max(120).optional(),
  tiktokHandle: z.string().max(120).optional(),
  workspaceType: z.enum(["HOME_SALON", "PRIVATE_ROOM", "CHAIR", "MOBILE"]).optional(),
  workspacePostcode: z.string().max(10).optional(),
  travelsToClients: z.boolean().optional(),
  /** Profile photo from the media library; nulls clear it. */
  avatar: z
    .object({ url: z.string().url().max(2_000), fileId: z.string().max(200) })
    .nullable()
    .optional(),
});

export const menuSchema = z.object({
  items: z
    .array(
      z.object({
        serviceId: z.string().min(1),
        priceMinor: z.number().int().min(0).max(1_000_000).nullable().optional(),
        durationMinutes: z.number().int().min(5).max(720).nullable().optional(),
      }),
    )
    .max(100),
});

export const lookbookSchema = z.object({
  images: z
    .array(
      z.object({
        url: z.string().url().max(2_000),
        fileId: z.string().max(200).default(""),
        caption: z.string().max(120).default(""),
      }),
    )
    .max(3),
});

export const documentSchema = z.object({
  kind: z.enum(["INSURANCE", "LICENCE", "CERTIFICATE"]),
  url: z.string().url().max(2_000),
  fileId: z.string().max(200).default(""),
  fileName: z.string().max(200).default(""),
  mimeType: z.string().max(100).default(""),
});

export const acceptingSchema = z.object({ accepting: z.boolean() });

export const cancelSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  /** The fee the customer saw and agreed to; refused if it has since gone up. */
  acceptedFeeMinor: z.number().int().min(0).optional(),
});
