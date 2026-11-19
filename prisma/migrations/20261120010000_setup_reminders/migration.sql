-- Reminders to vendors who haven't finished setting up.
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "setupReminderSentAt" TIMESTAMP(3);
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "setupRemindersSent" INTEGER NOT NULL DEFAULT 0;
