-- Ad performance reports: views and clicks per day, and a secret link to share them.
ALTER TABLE "AdPlacement" ADD COLUMN IF NOT EXISTS "reportToken" TEXT;
UPDATE "AdPlacement" SET "reportToken" = gen_random_uuid()::text WHERE "reportToken" IS NULL;
ALTER TABLE "AdPlacement" ALTER COLUMN "reportToken" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "AdPlacement_reportToken_key" ON "AdPlacement"("reportToken");

CREATE TABLE IF NOT EXISTS "AdDailyStat" (
    "adId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AdDailyStat_pkey" PRIMARY KEY ("adId", "day")
);

DO $$ BEGIN
  ALTER TABLE "AdDailyStat" ADD CONSTRAINT "AdDailyStat_adId_fkey"
    FOREIGN KEY ("adId") REFERENCES "AdPlacement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
