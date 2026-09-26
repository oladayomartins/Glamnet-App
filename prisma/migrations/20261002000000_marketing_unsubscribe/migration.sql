-- Marketing opt-out and a per-account unsubscribe token. Idempotent.
-- Existing accounts get a random token from the column default.

ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "marketingOptOutAt" TIMESTAMP(3);
ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "unsubscribeToken" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AppUser_unsubscribeToken_key" ON "AppUser"("unsubscribeToken");
