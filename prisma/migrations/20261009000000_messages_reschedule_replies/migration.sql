-- Review replies, reschedule suggestions and booking messages.
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "reviewReply" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "reviewRepliedAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "rescheduleStartAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "rescheduleBy" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "rescheduleRequestedAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "rescheduleCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "BookingMessage" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BookingMessage_bookingId_createdAt_idx" ON "BookingMessage"("bookingId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "BookingMessage" ADD CONSTRAINT "BookingMessage_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
