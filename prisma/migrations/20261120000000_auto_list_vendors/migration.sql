-- Vendors are now listed automatically, as "Not verified", once their
-- bookable basics are done (lib/server/provider-portal.ts autoListIfReady).
-- List the ones who already had them but never pressed submit. Same rules as
-- onboardingGaps: a name, a storefront link, a postcode, a street address
-- unless mobile-only, at least one service and some working hours.
UPDATE "Provider" AS p
SET "onboardedAt" = NOW(),
    "isAcceptingWork" = true
WHERE p."onboardedAt" IS NULL
  AND p."approvalStatus" = 'PENDING'
  AND length(trim(p."name")) >= 2
  AND p."slug" IS NOT NULL
  AND p."workspaceSector" <> ''
  AND (p."workspaceType" = 'MOBILE' OR trim(p."workspaceAddress") <> '')
  AND EXISTS (SELECT 1 FROM "ProviderService" s WHERE s."providerId" = p."id")
  AND EXISTS (SELECT 1 FROM "ProviderAvailability" a WHERE a."providerId" = p."id");
