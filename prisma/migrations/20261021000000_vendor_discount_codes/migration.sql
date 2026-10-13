-- Vendors' own discount codes, and the vendor-funded discount on a booking.
ALTER TABLE "PromoCode" ADD COLUMN IF NOT EXISTS "providerId" TEXT;
CREATE INDEX IF NOT EXISTS "PromoCode_providerId_idx" ON "PromoCode"("providerId");
DO $$ BEGIN
  ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "vendorDiscountMinor" INTEGER NOT NULL DEFAULT 0;
