-- A customer's remembered home postcode, for "pros near you". Idempotent.
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "postcode" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
