import { adminRoute } from "@/lib/api/admin-route";
import { createCity } from "@/lib/server/admin/cities";

/** POST /api/admin/cities — list a city under "Browse by city". */
export const POST = adminRoute(async ({ actor, body }) => ({ city: await createCity(actor, body) }));
