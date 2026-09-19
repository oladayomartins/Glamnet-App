-- Brings the migration history up to the schema the application already
-- requires.
--
-- The two migrations before this one stop short of `AppUser`, vendor approval
-- and the media columns, so a database built from migrations alone came up
-- without the table every signed-in request reads and without the column the
-- matching query filters on. Environments were being created with `db push`
-- instead, which is why it went unnoticed: nothing built from the history was
-- ever started.
--
-- Every statement is guarded, so a database that `db push` already brought up
-- to date steps over the objects it has rather than colliding with them.
--
-- Guards are not the whole story on such a database: `migrate deploy` refuses
-- it outright with P3005 before running any SQL, because there is no
-- `_prisma_migrations` table to reason from. It has to be baselined once —
-- see README.md in this folder for the two `migrate resolve` commands.

-- AlterTable
ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "referenceImageFileId" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "appUserId" TEXT;

-- AlterTable
--
-- `approvalStatus` defaults to PENDING, which is right for a row created from
-- now on. On a database that somehow carries vendors from before approval
-- existed, it would take every one of them off the marketplace at once — the
-- matching query only broadcasts to APPROVED. Who is approved is a vetting
-- decision, not something a migration should invent, so this does not
-- back-fill: check the table after deploying to such a database.
ALTER TABLE "Provider"
  ADD COLUMN IF NOT EXISTS "appUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "approvalNote" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "avatarFileId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Service"
  ADD COLUMN IF NOT EXISTS "imageFileId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "imageUrl" TEXT NOT NULL DEFAULT '';

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

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AppUser_email_key" ON "AppUser"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AppUser_role_idx" ON "AppUser"("role");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_appUserId_key" ON "Customer"("appUserId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Provider_appUserId_key" ON "Provider"("appUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Provider_approvalStatus_idx" ON "Provider"("approvalStatus");

-- AddForeignKey
--
-- Postgres has no `ADD CONSTRAINT IF NOT EXISTS`, so the guard is explicit.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Customer_appUserId_fkey'
  ) THEN
    ALTER TABLE "Customer"
      ADD CONSTRAINT "Customer_appUserId_fkey"
      FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Provider_appUserId_fkey'
  ) THEN
    ALTER TABLE "Provider"
      ADD CONSTRAINT "Provider_appUserId_fkey"
      FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
