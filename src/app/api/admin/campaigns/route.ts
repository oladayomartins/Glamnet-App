import { adminRoute } from "@/lib/api/admin-route";
import { createCampaign } from "@/lib/server/admin/marketing";

export const POST = adminRoute(async ({ actor, body }) => ({ campaign: await createCampaign(actor, body) }));
