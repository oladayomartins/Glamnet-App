-- Admin-editable commission and fee rates, and the rates each booking was made under.
CREATE TABLE IF NOT EXISTS "PlatformFeeConfig" (
    "id" TEXT NOT NULL,
    "discoveryCommissionBps" INTEGER NOT NULL,
    "repeatCommissionBps" INTEGER NOT NULL,
    "cardFeeBps" INTEGER NOT NULL,
    "trustFeeMinor" INTEGER NOT NULL,
    "directTrustFeeMinor" INTEGER NOT NULL,
    "lateCancellationFeeBps" INTEGER NOT NULL,
    "noShowFeeBps" INTEGER NOT NULL,
    "travelFeeMinor" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformFeeConfig_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PlatformFeeConfig_createdAt_idx" ON "PlatformFeeConfig"("createdAt");

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "feeConfigId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Booking" ADD CONSTRAINT "Booking_feeConfigId_fkey"
    FOREIGN KEY ("feeConfigId") REFERENCES "PlatformFeeConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
