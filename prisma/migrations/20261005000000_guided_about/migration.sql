-- The guided About: three short answers instead of one blank Bio box.
--
-- Added alongside "bio" rather than replacing it. A vendor who already wrote
-- free text has a working About, and migrating their prose into the wrong
-- one of three buckets would be a guess made on their behalf.
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "specialisesIn" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "whatToExpect" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "howToFindMe" TEXT NOT NULL DEFAULT '';
