-- Messages from the support contact form.
CREATE TABLE IF NOT EXISTS "SupportEnquiry" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "bookingRef" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "appUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "SupportEnquiry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SupportEnquiry_reference_key" ON "SupportEnquiry"("reference");
CREATE INDEX IF NOT EXISTS "SupportEnquiry_status_createdAt_idx" ON "SupportEnquiry"("status", "createdAt");
