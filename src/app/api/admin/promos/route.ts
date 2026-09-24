import { adminRoute } from "@/lib/api/admin-route";
import { createPromo } from "@/lib/server/admin/promos";

/** POST /api/admin/promos — create a promo code. */
export const POST = adminRoute(async ({ actor, body }) => ({ promo: await createPromo(actor, body) }));
