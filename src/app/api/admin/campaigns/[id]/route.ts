import { adminRoute } from "@/lib/api/admin-route";
import { deleteCampaign, updateCampaign } from "@/lib/server/admin/marketing";

export const PATCH = adminRoute<{ id: string }>(async ({ actor, params, body }) => ({
  campaign: await updateCampaign(actor, params.id, body),
}));

export const DELETE = adminRoute<{ id: string }>(async ({ actor, params }) => {
  await deleteCampaign(actor, params.id);
});
