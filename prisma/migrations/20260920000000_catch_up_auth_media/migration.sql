-- Catch-up: schema.prisma gained sign-in, vendor approval and media-library
-- columns without a matching migration, so `migrate deploy` on an empty
-- database produced a schema the app could not run against.
--
-- Every statement is idempotent, because databases that were brought up to
-- date with `prisma db push` already have these objects and must pass through
-- this migration unchanged.

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "referenceImageFileId" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "appUserId" TEXT;

ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "appUserId" TEXT,
ADD COLUMN IF NOT EXISTS "approvalNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "avatarFileId" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "imageFileId" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "imageUrl" TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS "AppUser" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AppUser_authUserId_key" ON "AppUser"("authUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "AppUser_email_key" ON "AppUser"("email");
CREATE INDEX IF NOT EXISTS "AppUser_role_idx" ON "AppUser"("role");
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_appUserId_key" ON "Customer"("appUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "Provider_appUserId_key" ON "Provider"("appUserId");
CREATE INDEX IF NOT EXISTS "Provider_approvalStatus_idx" ON "Provider"("approvalStatus");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Customer_appUserId_fkey') THEN
    ALTER TABLE "Customer" ADD CONSTRAINT "Customer_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Provider_appUserId_fkey') THEN
    ALTER TABLE "Provider" ADD CONSTRAINT "Provider_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
