-- Daily storefront view counts per vendor and source.
CREATE TABLE IF NOT EXISTS "StorefrontDailyStat" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StorefrontDailyStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StorefrontDailyStat_providerId_day_source_key" ON "StorefrontDailyStat"("providerId", "day", "source");

DO $$ BEGIN
  ALTER TABLE "StorefrontDailyStat" ADD CONSTRAINT "StorefrontDailyStat_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
