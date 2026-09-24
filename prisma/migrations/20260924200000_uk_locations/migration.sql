-- UK-wide locations: coordinates for hubs (outward codes, created on demand)
-- and a private base postcode + coordinates for vendors. Idempotent.
-- Existing rows are geocoded lazily by the app from postcodes.io.

ALTER TABLE "Hub" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "basePostcode" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
