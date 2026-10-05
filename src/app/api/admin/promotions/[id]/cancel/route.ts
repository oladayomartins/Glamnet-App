import { adminRoute } from "@/lib/api/admin-route";
import { cancelPromotion } from "@/lib/server/admin/promotions";

/** POST /api/admin/promotions/:id/cancel — end a promotion now, with or without a refund. */
export const POST = adminRoute<{ id: string }>(async ({ actor, params, body }) => {
  await cancelPromotion(actor, params.id, body);
});
