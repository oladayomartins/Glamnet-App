-- Vendor amenity tags.
--
-- A text[] rather than an enum or a join table: the catalogue lives in
-- lib/domain/vendor-tags.ts and is expected to grow, and unknown values are
-- dropped on read, so adding a tag never needs a migration and removing one
-- never orphans a row.
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[];
