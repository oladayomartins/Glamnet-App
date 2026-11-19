import { prisma } from "./prisma";
import { paymentGateway, PaymentError, type PaymentMode } from "./payments";
import { disputedAmountsOf } from "@/lib/domain/payment-rules";

/**
 * Earnings GLAMNET keeps back for a vendor who is listed but not verified.
 *
 * An unverified vendor takes bookings like anyone else, and the client's
 * card is captured on the PIN as normal (a card hold can't wait: Stripe
 * drops it after about seven days). Only the vendor's transfer waits. The
 * booking is marked `payoutHeld`, and every held payout goes out the moment
 * the vendor is verified with a bank that can receive it.
 *
 * A refund or dispute on a held booking recovers from the vendor by
 * recording a clawback: what is released is the payout less the clawback,
 * with no transfer to reverse.
 */

interface PayoutReadiness {
  isVerified: boolean;
  stripeAccountId: string;
  payoutsEnabled: boolean;
}

/** Whether a vendor's share must be kept back rather than paid now. */
export function mustHoldPayout(provider: PayoutReadiness, mode: PaymentMode): boolean {
  if (!provider.isVerified) return true;
  return mode === "stripe" && (!provider.stripeAccountId || !provider.payoutsEnabled);
}

/** What is still owed on a held booking. */
export function heldAmountOf(booking: Parameters<typeof disputedAmountsOf>[0] & { clawbackMinor: number }): number {
  return Math.max(0, disputedAmountsOf(booking).payoutMinor - booking.clawbackMinor);
}

/** The total a vendor has waiting, for their dashboard. */
export async function heldPayoutSummary(providerId: string) {
  const rows = await prisma.booking.findMany({
    where: { providerId, payoutHeld: true },
    select: {
      totalInvoicePriceMinor: true,
      tipMinor: true,
      discountMinor: true,
      providerPayoutMinor: true,
      cancellationFeeMinor: true,
      cancellationFeePayoutMinor: true,
      clawbackMinor: true,
    },
  });
  return { count: rows.length, totalMinor: rows.reduce((sum, row) => sum + heldAmountOf(row), 0) };
}

/**
 * Pay out everything held for a vendor, if they can now be paid. Safe to call
 * any time: a vendor who isn't ready, or has nothing held, is left alone, and
 * each transfer's idempotency key means a retry never pays twice. A booking
 * under dispute waits for its ruling.
 */
export async function releaseHeldPayouts(
  providerId: string,
): Promise<{ released: number; totalMinor: number; failed: number }> {
  const gateway = paymentGateway();
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    select: { isVerified: true, stripeAccountId: true, payoutsEnabled: true },
  });
  if (!provider || mustHoldPayout(provider, gateway.mode)) return { released: 0, totalMinor: 0, failed: 0 };

  const held = await prisma.booking.findMany({
    where: { providerId, payoutHeld: true, NOT: { settlementStatus: "DISPUTED" } },
    orderBy: { escrowReleasedAt: "asc" },
  });

  let released = 0;
  let totalMinor = 0;
  let failed = 0;
  for (const booking of held) {
    const amountMinor = heldAmountOf(booking);
    let transferId = "";
    if (amountMinor > 0 && booking.paymentIntentId) {
      try {
        ({ transferId } = await gateway.transferHeldPayout({
          bookingId: booking.id,
          paymentIntentId: booking.paymentIntentId,
          destinationAccountId: provider.stripeAccountId || `sim_acct_${providerId}`,
          amountMinor,
        }));
      } catch (error) {
        // One refused transfer mustn't hold up the rest; it stays held and is
        // retried by the daily job (retryHeldPayouts).
        if (error instanceof PaymentError) {
          console.error(`Held payout for booking ${booking.id} refused: ${error.message}`);
          failed += 1;
          continue;
        }
        throw error;
      }
    }
    const claimed = await prisma.booking.updateMany({
      where: { id: booking.id, payoutHeld: true },
      data: { payoutHeld: false, transferId },
    });
    if (claimed.count === 0) continue;
    await prisma.bookingStatusEvent.create({
      data: {
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: booking.status,
        actor: "SYSTEM",
        note: amountMinor > 0 ? "Vendor verified; held payout transferred." : "Vendor verified; nothing left to pay after refunds.",
      },
    });
    released += 1;
    totalMinor += amountMinor;
  }
  return { released, totalMinor, failed };
}

/**
 * The daily retry, run by the settlements cron. Picks up every verified
 * vendor who still has payouts held: one whose transfer Stripe refused, one
 * whose dispute has since been ruled, or one whose bank only started working
 * after a webhook we missed — so their Stripe status is re-read first.
 *
 * One vendor's or booking's failure never stops the rest; `failed` counts
 * bookings Stripe refused plus vendors that errored, and both are tried
 * again tomorrow.
 */
export async function retryHeldPayouts(): Promise<{
  vendors: number;
  released: number;
  totalMinor: number;
  failed: number;
}> {
  const gateway = paymentGateway();
  const vendors = await prisma.provider.findMany({
    where: {
      isVerified: true,
      bookings: { some: { payoutHeld: true, NOT: { settlementStatus: "DISPUTED" } } },
    },
    select: { id: true, stripeAccountId: true, payoutsEnabled: true },
  });

  const totals = { vendors: vendors.length, released: 0, totalMinor: 0, failed: 0 };
  for (const vendor of vendors) {
    try {
      if (gateway.mode === "stripe" && vendor.stripeAccountId && !vendor.payoutsEnabled) {
        const enabled = await gateway.payoutsEnabled(vendor.stripeAccountId);
        if (!enabled) continue;
        await prisma.provider.update({ where: { id: vendor.id }, data: { payoutsEnabled: true } });
      }
      const result = await releaseHeldPayouts(vendor.id);
      totals.released += result.released;
      totals.totalMinor += result.totalMinor;
      totals.failed += result.failed;
    } catch (error) {
      totals.failed += 1;
      console.error(`retryHeldPayouts: vendor ${vendor.id}`, error);
    }
  }
  return totals;
}
