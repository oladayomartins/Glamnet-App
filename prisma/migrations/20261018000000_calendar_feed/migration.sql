-- Secret link for a vendor's calendar feed.
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "calendarToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Provider_calendarToken_key" ON "Provider"("calendarToken");
