import { adminRoute } from "@/lib/api/admin-route";
import { createService } from "@/lib/server/admin/catalogue";

/** POST /api/admin/services — add a service to the catalogue. */
export const POST = adminRoute(async ({ actor, body }) => ({ service: await createService(actor, body) }));
