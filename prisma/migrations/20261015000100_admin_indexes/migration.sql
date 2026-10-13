-- Indexes for the admin console's date-ranged and by-category queries.
CREATE INDEX IF NOT EXISTS "Booking_bookingCreatedAt_idx" ON "Booking"("bookingCreatedAt");
CREATE INDEX IF NOT EXISTS "Booking_cancelledAt_idx" ON "Booking"("cancelledAt");
CREATE INDEX IF NOT EXISTS "Service_category_idx" ON "Service"("category");
