import { adminRoute } from "@/lib/api/admin-route";
import { deletePromo, updatePromo } from "@/lib/server/admin/promos";

export const PATCH = adminRoute<{ id: string }>(async ({ actor, params, body }) => ({
  promo: await updatePromo(actor, params.id, body),
}));

export const DELETE = adminRoute<{ id: string }>(async ({ actor, params }) => {
  await deletePromo(actor, params.id);
});
