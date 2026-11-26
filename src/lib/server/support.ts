import { z } from "zod";
import { prisma } from "./prisma";
import { sendEmail } from "./email";
import { bookingNoticeEmail } from "@/lib/email/templates";
import { LEGAL } from "@/lib/legal";
import { siteUrl } from "@/lib/site";
import {
  ENQUIRER_ROLES,
  categoriesFor,
  categoryByValue,
  enquiryReference,
  type EnquirerRole,
} from "@/lib/domain/support-enquiry";

/** Enquiries one email address may send in an hour, to keep the inbox usable. */
const HOURLY_LIMIT = 5;

export const enquirySchema = z.object({
  role: z.enum(ENQUIRER_ROLES.map((role) => role.value) as [EnquirerRole, ...EnquirerRole[]]),
  category: z.string().min(1).max(40),
  topic: z.string().min(1).max(120),
  bookingRef: z.string().trim().max(60).optional().default(""),
  name: z.string().trim().min(2, "Tell us your name.").max(120),
  email: z.string().trim().email("Enter a valid email address.").max(200),
  message: z.string().trim().min(10, "Tell us a little more (10 characters or more).").max(5_000),
  /** Honeypot: a field people never see. Anything in it is a bot. */
  website: z.string().max(0).optional().default(""),
});

export type EnquiryInput = z.input<typeof enquirySchema>;

export type EnquiryResult =
  | { ok: true; reference: string }
  | { ok: false; status: number; message: string };

/**
 * Take a support enquiry from the contact form: check it, keep it (so
 * nothing is lost if email fails), email it to the support inbox with the
 * sender as reply-to, and send the sender a copy with their reference.
 */
export async function submitEnquiry(raw: unknown, appUserId: string | null): Promise<EnquiryResult> {
  const input = enquirySchema.parse(raw);

  const category = categoryByValue(input.category);
  if (!category || !categoriesFor(input.role).includes(category) || !category.topics.includes(input.topic)) {
    return { ok: false, status: 422, message: "Choose what your enquiry is about from the lists." };
  }

  const since = new Date(Date.now() - 60 * 60 * 1_000);
  const recent = await prisma.supportEnquiry.count({
    where: { email: { equals: input.email, mode: "insensitive" }, createdAt: { gte: since } },
  });
  if (recent >= HOURLY_LIMIT) {
    return {
      ok: false,
      status: 429,
      message: `You've sent a few messages already — we'll reply to those. For anything urgent, email ${LEGAL.contactEmail}.`,
    };
  }

  // A reference collision is vanishingly rare; try again rather than fail.
  let enquiry = null;
  for (let attempt = 0; attempt < 3 && !enquiry; attempt += 1) {
    try {
      enquiry = await prisma.supportEnquiry.create({
        data: {
          reference: enquiryReference(),
          role: input.role,
          category: category.value,
          topic: input.topic,
          bookingRef: category.askBooking ? input.bookingRef : "",
          name: input.name,
          email: input.email,
          message: input.message,
          appUserId,
          urgent: category.urgent === true,
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
    }
  }
  if (!enquiry) return { ok: false, status: 500, message: "We couldn't send that. Please try again." };

  const roleLabel = ENQUIRER_ROLES.find((role) => role.value === input.role)?.label ?? input.role;
  const facts: Array<[string, string]> = [
    ["Reference", enquiry.reference],
    ["From", `${input.name} <${input.email}>`],
    ["Who", roleLabel],
    ["About", `${category.label} — ${input.topic}`],
    ...(enquiry.bookingRef ? ([["Booking", enquiry.bookingRef]] as Array<[string, string]>) : []),
  ];

  // With Web3Forms set up, the browser forwards the enquiry to the support
  // inbox itself (its free plan only takes browser submissions), so the
  // server doesn't email the team as well — one copy, not two.
  const teamEmail = web3FormsAccessKey()
    ? Promise.resolve()
    : sendEmail({
      to: LEGAL.contactEmail,
      replyTo: input.email,
      ...bookingNoticeEmail({
        subject: `${category.urgent ? "[URGENT] " : ""}${enquiry.reference} · ${category.label}: ${input.topic}`,
        heading: `${category.urgent ? "Urgent: " : ""}${category.label}`,
        name: "team",
        lead: input.message,
        facts,
        cta: { label: "Open the support inbox", url: `${siteUrl()}/admin/support` },
      }),
    });

  // Best effort: the enquiry is saved either way, and admins see it in the inbox.
  await Promise.all([
    teamEmail,
    sendEmail({
      to: input.email,
      ...bookingNoticeEmail({
        subject: `We've got your message (${enquiry.reference})`,
        heading: "Thanks — we've got your message",
        name: input.name.split(/\s+/)[0] || input.name,
        lead: `We'll reply to this email address as soon as we can, usually within one working day. Quote ${enquiry.reference} if you get in touch about this again.`,
        facts: [
          ["Reference", enquiry.reference],
          ["About", `${category.label} — ${input.topic}`],
        ],
        cta: { label: "Browse the help centre", url: `${siteUrl()}/support` },
      }),
    }),
  ]).catch((error) => console.error("[support] email failed", error));

  return { ok: true, reference: enquiry.reference };
}

/**
 * The Web3Forms access key, when the contact form forwards to it. Public by
 * design (Web3Forms keys are made for browser code), so it lives in a
 * NEXT_PUBLIC_ variable the form can read.
 */
export function web3FormsAccessKey(): string {
  return process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY?.trim() ?? "";
}
