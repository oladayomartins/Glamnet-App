-- When a vendor document (insurance, licence) runs out.
ALTER TABLE "ProviderDocument" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
