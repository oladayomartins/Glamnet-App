-- Vendors can pin services to the front of their storefront menu.
--
-- Defaulting to false means every existing menu keeps its current behaviour:
-- with nothing pinned the storefront falls back to leading with the cheapest
-- services, so no vendor's page changes until they choose to change it.
ALTER TABLE "ProviderService" ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false;
