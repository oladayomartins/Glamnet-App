import { adminRoute } from "@/lib/api/admin-route";
import { deleteAd, updateAd } from "@/lib/server/admin/marketing";

export const PATCH = adminRoute<{ id: string }>(async ({ actor, params, body }) => ({
  ad: await updateAd(actor, params.id, body),
}));

export const DELETE = adminRoute<{ id: string }>(async ({ actor, params }) => {
  await deleteAd(actor, params.id);
});
