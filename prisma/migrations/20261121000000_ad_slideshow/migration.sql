-- Ad spots slide between their live ads: seconds each ad stays on screen.
ALTER TABLE "AdPlacement" ADD COLUMN IF NOT EXISTS "slideSeconds" INTEGER NOT NULL DEFAULT 6;
