import { adminRoute } from "@/lib/api/admin-route";
import { sendCampaignEmail } from "@/lib/server/admin/marketing";

/** POST /api/admin/campaigns/:id/send — email the campaign to its audience, once. */
export const POST = adminRoute<{ id: string }>(async ({ actor, params }) => ({
  sent: await sendCampaignEmail(actor, params.id),
}));
