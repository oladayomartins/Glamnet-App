-- A vendor's private notes about their clients.
CREATE TABLE IF NOT EXISTS "ProviderClientNote" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProviderClientNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProviderClientNote_providerId_customerId_key" ON "ProviderClientNote"("providerId", "customerId");

DO $$ BEGIN
  ALTER TABLE "ProviderClientNote" ADD CONSTRAINT "ProviderClientNote_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProviderClientNote" ADD CONSTRAINT "ProviderClientNote_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
