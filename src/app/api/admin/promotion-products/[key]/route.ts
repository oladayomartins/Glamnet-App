import { adminRoute } from "@/lib/api/admin-route";
import { updatePromotionProduct } from "@/lib/server/admin/promotions";

/** PATCH /api/admin/promotion-products/:key — prices, slots, on sale or not. */
export const PATCH = adminRoute<{ key: string }>(async ({ actor, params, body }) => ({
  product: await updatePromotionProduct(actor, params.key, body),
}));
