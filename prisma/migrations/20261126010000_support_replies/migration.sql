-- Admins reply to support enquiries from the inbox; each reply is kept.
CREATE TABLE IF NOT EXISTS "SupportReply" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message" TEXT NOT NULL,
    "sentBy" TEXT NOT NULL,
    "emailed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "SupportReply_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SupportReply_enquiryId_createdAt_idx" ON "SupportReply"("enquiryId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "SupportReply" ADD CONSTRAINT "SupportReply_enquiryId_fkey"
    FOREIGN KEY ("enquiryId") REFERENCES "SupportEnquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
