import { adminRoute } from "@/lib/api/admin-route";
import { createCategory } from "@/lib/server/admin/catalogue";

/** POST /api/admin/categories — add a Specialty Hub. */
export const POST = adminRoute(async ({ actor, body }) => ({ category: await createCategory(actor, body) }));
