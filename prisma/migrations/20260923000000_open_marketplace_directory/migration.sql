-- Open Marketplace Directory: vendor storefronts, the dual-commission
-- protocol, card-hold escrow with PIN release, and the 24-hour dispute window.

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "commissionBps" INTEGER NOT NULL DEFAULT 3000,
ADD COLUMN     "completionPin" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "completionPinAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "completionPinIssuedAt" TIMESTAMP(3),
ADD COLUMN     "disputeReason" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "disputeWindowClosesAt" TIMESTAMP(3),
ADD COLUMN     "disputedAt" TIMESTAMP(3),
ADD COLUMN     "escrowReleasedAt" TIMESTAMP(3),
ADD COLUMN     "firstDiscoveryBooking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentIntentId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN     "platformCommissionMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "processingFeeMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "providerPayoutMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "serviceLocation" TEXT NOT NULL DEFAULT 'CUSTOMER_ADDRESS',
ADD COLUMN     "settlementStatus" TEXT NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'BROADCAST',
ADD COLUMN     "tipMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "transferId" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Provider" ADD COLUMN     "instagramHandle" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardedAt" TIMESTAMP(3),
ADD COLUMN     "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "stripeAccountId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "tiktokHandle" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "travelsToClients" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "workspaceSector" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "workspaceType" TEXT NOT NULL DEFAULT 'MOBILE';

-- AlterTable
ALTER TABLE "ProviderService" ADD COLUMN     "durationMinutes" INTEGER,
ADD COLUMN     "priceMinor" INTEGER;

-- CreateTable
CREATE TABLE "ProviderLookbookImage" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileId" TEXT NOT NULL DEFAULT '',
    "caption" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderLookbookImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderDocument" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL,
    "fileId" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ProviderDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingCompletionPhoto" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileId" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingCompletionPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderLookbookImage_providerId_position_idx" ON "ProviderLookbookImage"("providerId", "position");

-- CreateIndex
CREATE INDEX "ProviderDocument_providerId_idx" ON "ProviderDocument"("providerId");

-- CreateIndex
CREATE INDEX "ProviderDocument_status_idx" ON "ProviderDocument"("status");

-- CreateIndex
CREATE INDEX "BookingCompletionPhoto_bookingId_idx" ON "BookingCompletionPhoto"("bookingId");

-- CreateIndex
CREATE INDEX "Booking_customerId_providerId_idx" ON "Booking"("customerId", "providerId");

-- CreateIndex
CREATE INDEX "Booking_settlementStatus_disputeWindowClosesAt_idx" ON "Booking"("settlementStatus", "disputeWindowClosesAt");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_slug_key" ON "Provider"("slug");

-- AddForeignKey
ALTER TABLE "ProviderLookbookImage" ADD CONSTRAINT "ProviderLookbookImage_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDocument" ADD CONSTRAINT "ProviderDocument_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCompletionPhoto" ADD CONSTRAINT "BookingCompletionPhoto_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: every booking before this migration came through the broadcast
-- and was priced at the 70/30 split, so its payout is what it already quoted.
UPDATE "Booking"
SET "providerPayoutMinor" = "providerEarningsMinor",
    "platformCommissionMinor" = GREATEST(
      0,
      "totalInvoicePriceMinor" - "trustFeeMinor" - "providerEarningsMinor"
    )
WHERE "providerPayoutMinor" = 0;

-- Vendors already approved before verification existed are verified.
UPDATE "Provider" SET "isVerified" = true WHERE "approvalStatus" = 'APPROVED';
