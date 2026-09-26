-- Accounts, provider vetting and the media library.
--
-- These columns and tables were added to schema.prisma when Supabase Auth,
-- the approvals queue and ImageKit went in, but no migration was ever
-- generated for them: the live database was brought up to date with
-- `prisma db push` instead. That left `prisma migrate deploy` producing a
-- database the application cannot run against — a fresh environment got a
-- Service table with no imageUrl, and every query against it failed with
-- P2022. This migration closes that gap.
--
-- Every statement is written to be safe on a database that already has these
-- objects, because production does. Postgres has no "ADD CONSTRAINT IF NOT
-- EXISTS", so the two foreign keys are guarded by catalogue lookups instead.
-- The result is a no-op against the live database and a correct schema
-- against an empty one.

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "referenceImageFileId" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "appUserId" TEXT;

-- AlterTable
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "appUserId" TEXT;
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "approvalNote" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "avatarFileId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "imageFileId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE IF NOT EXISTS "AppUser" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AppUser_authUserId_key" ON "AppUser"("authUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "AppUser_email_key" ON "AppUser"("email");
CREATE INDEX IF NOT EXISTS "AppUser_role_idx" ON "AppUser"("role");
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_appUserId_key" ON "Customer"("appUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "Provider_appUserId_key" ON "Provider"("appUserId");
CREATE INDEX IF NOT EXISTS "Provider_approvalStatus_idx" ON "Provider"("approvalStatus");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Customer_appUserId_fkey'
  ) THEN
    ALTER TABLE "Customer" ADD CONSTRAINT "Customer_appUserId_fkey"
      FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Provider_appUserId_fkey'
  ) THEN
    ALTER TABLE "Provider" ADD CONSTRAINT "Provider_appUserId_fkey"
      FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
