-- Admin history for one account or booking.
CREATE INDEX IF NOT EXISTS "AdminAuditLog_targetId_idx" ON "AdminAuditLog"("targetId");
