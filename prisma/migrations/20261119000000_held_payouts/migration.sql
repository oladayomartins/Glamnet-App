-- Earnings kept back for vendors who are listed but not verified yet.
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "payoutHeld" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "Booking_providerId_payoutHeld_idx" ON "Booking"("providerId", "payoutHeld");
