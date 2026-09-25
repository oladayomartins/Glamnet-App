-- A customer's profile photo, shown in the header account menu. Idempotent.
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "avatarFileId" TEXT NOT NULL DEFAULT '';
