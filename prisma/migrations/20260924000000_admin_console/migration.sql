-- Admin console: categories, campaigns, ad placements, audit log, account
-- suspension and featured vendors. Idempotent, like the migrations before it.

-- AlterTable
ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "suspendedReason" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '',
    "blurb" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "imageFileId" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'ALL',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "ctaLabel" TEXT NOT NULL DEFAULT '',
    "ctaUrl" TEXT NOT NULL DEFAULT '',
    "showBanner" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" TIMESTAMP(3),
    "emailSentTo" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdPlacement" (
    "id" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "imageFileId" TEXT NOT NULL DEFAULT '',
    "linkUrl" TEXT NOT NULL DEFAULT '',
    "advertiser" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Category_isActive_sortOrder_idx" ON "Category"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Campaign_isActive_startsAt_idx" ON "Campaign"("isActive", "startsAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdPlacement_slot_isActive_idx" ON "AdPlacement"("slot", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");


-- Same posture as every other public table: RLS on with no policies, so the
-- Supabase REST API cannot read or write these. Prisma connects as the owner.
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Campaign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdPlacement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminAuditLog" ENABLE ROW LEVEL SECURITY;

-- The five Specialty Hubs the site launched with, now editable by admins.
INSERT INTO "Category" ("id", "slug", "name", "emoji", "blurb", "sortOrder", "updatedAt") VALUES
  ('cat_afro_textured', 'afro-textured', 'Afro & Textured', '🌍', 'Braids, twists and protective styling', 10, CURRENT_TIMESTAMP),
  ('cat_european_western', 'european-western', 'European & Western', '👱‍♀️', 'Blow-dries, technical updos and curls', 20, CURRENT_TIMESTAMP),
  ('cat_mua_bridal', 'mua-bridal', 'MUA Glam & Asian Bridal', '👑', 'Cosmetics, bridal looks and traditional gele ties', 30, CURRENT_TIMESTAMP),
  ('cat_nails', 'nails', 'Manicures & Pedicures', '💅', 'Gel, BIAB and nail overlays', 40, CURRENT_TIMESTAMP),
  ('cat_massage_wellness', 'massage-wellness', 'Massage & Wellness', '💆‍♀️', 'Deep tissue, sports and therapeutic massage', 50, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
