-- Customers can save a vendor to come back to.
--
-- The (customerId, providerId) pair is the primary key rather than a surrogate
-- id: saving twice is the same as saving once, so the constraint makes the
-- button idempotent without the API having to read before it writes.
CREATE TABLE IF NOT EXISTS "SavedVendor" (
    "customerId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedVendor_pkey" PRIMARY KEY ("customerId","providerId")
);

CREATE INDEX IF NOT EXISTS "SavedVendor_customerId_createdAt_idx" ON "SavedVendor"("customerId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SavedVendor_customerId_fkey') THEN
    ALTER TABLE "SavedVendor" ADD CONSTRAINT "SavedVendor_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SavedVendor_providerId_fkey') THEN
    ALTER TABLE "SavedVendor" ADD CONSTRAINT "SavedVendor_providerId_fkey"
      FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
