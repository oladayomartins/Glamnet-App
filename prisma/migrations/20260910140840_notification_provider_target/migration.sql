-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "providerId" TEXT;

-- CreateIndex
CREATE INDEX "Notification_providerId_createdAt_idx" ON "Notification"("providerId", "createdAt");
