import { prisma } from "./prisma";
import { onHoldCancelled, securePayment } from "./payment-flow";
import { formatMoney } from "@/lib/domain/pricing";

/**
 * What Stripe tells us, as it happens.
 *
 * Every handler is idempotent and checks the booking's current state before
 * acting, so an event that arrives twice, late, or after the browser already
 * reported the same thing changes nothing the second time. Each event id is
 * also recorded, and a repeat is skipped outright.
 */

interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

type Handler = (object: Record<string, unknown>) => Promise<void>;

const str = (value: unknown) => (typeof value === "string" ? value : "");
const num = (value: unknown) => (typeof value === "number" ? value : 0);

const HANDLERS: Record<string, Handler> = {
  /**
   * A card hold succeeded. Normally the browser reports this first; this is
   * for the customer who closes the tab mid-way, or whose bank sent them off
   * to approve it.
   */
  "payment_intent.amount_capturable_updated": async (intent) => {
    const booking = await prisma.booking.findFirst({
      where: { paymentIntentId: str(intent.id), paymentStatus: { in: ["PENDING_AUTHORISATION", "AUTHORISATION_FAILED"] } },
    });
    if (booking) await securePayment(booking.id, { paymentStatus: "AUTHORISED" });
  },

  /** A card was saved for a far-off booking. */
  "setup_intent.succeeded": async (setup) => {
    const booking = await prisma.booking.findFirst({
      where: { setupIntentId: str(setup.id), paymentStatus: { in: ["PENDING_AUTHORISATION", "AUTHORISATION_FAILED"] } },
    });
    if (booking) {
      await securePayment(booking.id, { paymentStatus: "CARD_SAVED", paymentMethodId: str(setup.payment_method) });
    }
  },

  /**
   * A hold was cancelled. Ours are recorded when we make them; one Stripe
   * dropped on its own (after about seven days) on a booking still going
   * ahead means asking the customer for their card again.
   */
  "payment_intent.canceled": async (intent) => {
    if (str(intent.cancellation_reason) === "automatic") await onHoldCancelled(str(intent.id));
  },

  /** A vendor finished (or lost) their payout set-up in Stripe. */
  "account.updated": async (account) => {
    await prisma.provider.updateMany({
      where: { stripeAccountId: str(account.id) },
      data: { payoutsEnabled: account.payouts_enabled === true },
    });
  },

  /**
   * A refund made in the Stripe dashboard rather than through a dispute
   * ruling. Recorded so the booking and the finance page agree with Stripe.
   */
  "charge.refunded": async (charge) => {
    const booking = await prisma.booking.findFirst({ where: { paymentIntentId: str(charge.payment_intent) } });
    const refunded = num(charge.amount_refunded);
    if (!booking || refunded <= booking.refundedMinor) return;
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        refundedMinor: refunded,
        paymentStatus: charge.refunded === true ? "REFUNDED" : "PARTIALLY_REFUNDED",
        events: {
          create: {
            fromStatus: booking.status,
            toStatus: booking.status,
            actor: "STRIPE",
            note: `Refund of ${formatMoney(refunded - booking.refundedMinor)} recorded from Stripe.`,
          },
        },
      },
    });
  },

  /**
   * A card chargeback: the customer's bank is disputing the charge. This is
   * separate from a GLAMNET service dispute and is answered in Stripe, so the
   * team is alerted with the details.
   */
  "charge.dispute.created": async (dispute) => {
    const booking = await prisma.booking.findFirst({ where: { paymentIntentId: str(dispute.payment_intent) } });
    if (!booking) return;
    const note = `Card chargeback opened: ${formatMoney(num(dispute.amount))}, reason "${str(dispute.reason) || "unknown"}". Respond in the Stripe dashboard.`;
    await prisma.$transaction([
      prisma.bookingStatusEvent.create({
        data: { bookingId: booking.id, fromStatus: booking.status, toStatus: booking.status, actor: "STRIPE", note },
      }),
      prisma.notification.create({
        data: {
          bookingId: booking.id,
          audience: "ADMIN",
          channel: "IN_APP",
          bookingType: booking.bookingType,
          title: "Card chargeback opened",
          body: note,
        },
      }),
    ]);
  },

  "charge.dispute.closed": async (dispute) => {
    const booking = await prisma.booking.findFirst({ where: { paymentIntentId: str(dispute.payment_intent) } });
    if (!booking) return;
    await prisma.bookingStatusEvent.create({
      data: {
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: booking.status,
        actor: "STRIPE",
        note: `Card chargeback closed: ${str(dispute.status) || "closed"}.`,
      },
    });
  },
};

/** The event types to subscribe the endpoint to in the Stripe dashboard. */
export const WEBHOOK_EVENT_TYPES = Object.keys(HANDLERS);

/** Handle one verified event. Returns false for a repeat or an unhandled type. */
export async function handleStripeEvent(event: StripeEvent): Promise<boolean> {
  const handler = HANDLERS[event.type];
  if (!handler) return false;
  if (await prisma.stripeEvent.findUnique({ where: { id: event.id } })) return false;

  // Handled first, recorded after: if handling fails, Stripe retries and the
  // retry isn't mistaken for a repeat. Handlers are idempotent, so a retry of
  // one that half-succeeded is safe.
  await handler(event.data.object);
  await prisma.stripeEvent
    .create({ data: { id: event.id, type: event.type } })
    .catch(() => undefined);
  return true;
}
