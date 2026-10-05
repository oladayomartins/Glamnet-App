-- Paid promotions: placements vendors can buy, and each purchase.
CREATE TABLE IF NOT EXISTS "PromotionProduct" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "slots" INTEGER NOT NULL DEFAULT 3,
    "price7Minor" INTEGER NOT NULL DEFAULT 0,
    "price14Minor" INTEGER NOT NULL DEFAULT 0,
    "price30Minor" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PromotionProduct_pkey" PRIMARY KEY ("key")
);

CREATE TABLE IF NOT EXISTS "Promotion" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "productKey" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT '',
    "days" INTEGER NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "holdExpiresAt" TIMESTAMP(3),
    "checkoutSessionId" TEXT NOT NULL DEFAULT '',
    "paymentIntentId" TEXT NOT NULL DEFAULT '',
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Promotion_productKey_city_status_idx" ON "Promotion"("productKey", "city", "status");
CREATE INDEX IF NOT EXISTS "Promotion_providerId_idx" ON "Promotion"("providerId");
CREATE INDEX IF NOT EXISTS "Promotion_checkoutSessionId_idx" ON "Promotion"("checkoutSessionId");

DO $$ BEGIN
  ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- The three placements, priced as a starting point and switched OFF: nothing
-- is on sale until an admin reviews the prices and turns it on.
INSERT INTO "PromotionProduct" ("key", "name", "description", "slots", "price7Minor", "price14Minor", "price30Minor", "isActive", "updatedAt") VALUES
  ('SEARCH_TOP', 'Top of search', 'One of the first three results, marked Sponsored, when clients in your city search for something you offer.', 3, 1500, 2500, 4500, false, CURRENT_TIMESTAMP),
  ('DIRECTORY_FEATURED', 'Featured in your city', 'Listed first in your city''s salon directory, with a Sponsored badge and a highlighted map pin.', 6, 1000, 1800, 3000, false, CURRENT_TIMESTAMP),
  ('HOME_SPOTLIGHT', 'Home page spotlight', 'A place in the Sponsored pros row on the GLAMNET home page, seen by every visitor.', 4, 2500, 4500, 8000, false, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
