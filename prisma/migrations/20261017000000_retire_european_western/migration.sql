-- GLAMNET is now the UK's marketplace for the Black and Asian beauty
-- community, and no longer offers the European & Western hub.
--
-- Retired rather than deleted, so nothing that points at it breaks: its
-- services come off every menu and search (past bookings keep their lines),
-- codes limited to it are paused rather than widened, and the hub itself is
-- hidden. An admin can bring any of it back from the console.
UPDATE "Service" SET "isActive" = false WHERE "category" = 'European & Western';
UPDATE "PromoCode" SET "isActive" = false WHERE "category" = 'European & Western';
UPDATE "Category" SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP WHERE "slug" = 'european-western';
