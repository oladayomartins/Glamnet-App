-- Card holds for every checkout, saved cards for far-off bookings, Stripe
-- webhooks and dispute refunds. Idempotent.

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "setupIntentId" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "paymentMethodId" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "holdAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "holdAuthorisedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "paymentFailureReason" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "refundedMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "clawbackMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "refundId" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "transferReversalId" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "disputeResolution" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "disputeResolvedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "disputeResolvedBy" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE IF NOT EXISTS "StripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: the daily job looks for saved cards due a hold.
CREATE INDEX IF NOT EXISTS "Booking_paymentStatus_appointmentStartAt_idx" ON "Booking"("paymentStatus", "appointmentStartAt");

ALTER TABLE "StripeEvent" ENABLE ROW LEVEL SECURITY;
