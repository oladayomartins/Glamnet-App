import { adminRoute } from "@/lib/api/admin-route";
import { createAd } from "@/lib/server/admin/marketing";

export const POST = adminRoute(async ({ actor, body }) => ({ ad: await createAd(actor, body) }));
