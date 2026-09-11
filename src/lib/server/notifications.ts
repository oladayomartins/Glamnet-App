import { prisma } from "./prisma";
import { sendEmail, sendEmails } from "./email";
import {
  customerBookingConfirmedEmail,
  providerApprovalEmail,
  providerBroadcastEmail,
  type BookingEmailFacts,
} from "@/lib/email/templates";
import { formatMoney } from "@/lib/domain/pricing";
import { siteUrl } from "@/lib/site";

/**
 * Delivery of the notifications the booking flow records.
 *
 * The `Notification` rows written inside each booking transaction are the
 * durable record — they survive, are shown in-app, and are what an audit reads.
 * This module is the *delivery* half: it turns those moments into email.
 *
 * Two rules, both deliberate:
 *
 *  - **Called after the transaction commits, never inside it.** An email send
 *    inside `prisma.$transaction` would hold a database connection open for the
 *    duration of an HTTP call to a third party, and a Resend timeout would then
 *    roll back a booking that was otherwise perfectly valid. The mail is a
 *    consequence of the commit, so it happens after it.
 *  - **Failure is swallowed here, not propagated.** Everything below resolves;
 *    `sendEmails` already degrades rather than throwing, and the queries are
 *    wrapped so a lookup failure cannot turn a successful booking into a 500.
 */

/** "Today, 18:00" / "Fri 12 Sep, 18:00", fixed to UK time. */
function formatAppointment(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(value);
}

function bookingUrl(path: string): string {
  return `${siteUrl()}${path}`;
}

/**
 * Email the vendors a new request was broadcast to.
 *
 * One batched call rather than five sequential ones: the acceptance window is
 * ten minutes and every vendor should see the request at the same moment,
 * not staggered by however long the previous send took.
 */
export async function deliverBroadcastEmails(input: {
  bookingId: string;
  providerIds: string[];
  isEmergency: boolean;
  serviceNames: string[];
  appointmentStartAt: Date;
  sector: string;
  providerEarningsMinor: number;
}): Promise<void> {
  if (input.providerIds.length === 0) return;

  try {
    const providers = await prisma.provider.findMany({
      where: { id: { in: input.providerIds } },
      select: { id: true, name: true, email: true },
    });

    const facts: BookingEmailFacts = {
      isEmergency: input.isEmergency,
      serviceNames: input.serviceNames,
      appointmentLabel: formatAppointment(input.appointmentStartAt),
      amountLabel: formatMoney(input.providerEarningsMinor),
      sector: input.sector,
      url: bookingUrl("/provider"),
    };

    await sendEmails(
      providers.map((provider) => ({
        to: provider.email,
        ...providerBroadcastEmail(provider.name, facts),
      })),
    );
  } catch (cause) {
    console.error("[notifications] broadcast email failed:", cause);
  }
}

/** Email the customer that a vendor has claimed their booking. */
export async function deliverBookingConfirmedEmail(input: {
  bookingId: string;
  customerName: string;
  customerEmail: string;
  providerName: string;
  isEmergency: boolean;
  serviceNames: string[];
  appointmentStartAt: Date;
  sector: string;
  totalInvoicePriceMinor: number;
}): Promise<void> {
  try {
    await sendEmail({
      to: input.customerEmail,
      ...customerBookingConfirmedEmail(input.customerName, input.providerName, {
        isEmergency: input.isEmergency,
        serviceNames: input.serviceNames,
        appointmentLabel: formatAppointment(input.appointmentStartAt),
        amountLabel: formatMoney(input.totalInvoicePriceMinor),
        sector: input.sector,
        url: bookingUrl(`/bookings/${input.bookingId}`),
      }),
    });
  } catch (cause) {
    console.error("[notifications] confirmation email failed:", cause);
  }
}

/** Email a vendor the outcome of their application. */
export async function deliverApprovalEmail(input: {
  name: string;
  email: string;
  decision: "APPROVED" | "REJECTED" | "PENDING";
  note: string;
}): Promise<void> {
  try {
    await sendEmail({
      to: input.email,
      ...providerApprovalEmail(
        input.name,
        input.decision,
        input.note,
        bookingUrl(input.decision === "APPROVED" ? "/provider" : "/provider/pending"),
      ),
    });
  } catch (cause) {
    console.error("[notifications] approval email failed:", cause);
  }
}
