-- Street address of a vendor's workspace, shown only to clients with a paid
-- booking there.
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "workspaceAddress" TEXT NOT NULL DEFAULT '';
