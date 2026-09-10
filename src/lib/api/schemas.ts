import { z } from "zod";

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
