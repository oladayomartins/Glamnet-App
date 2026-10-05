import { adminRoute } from "@/lib/api/admin-route";
import { duplicateAd } from "@/lib/server/admin/marketing";

export const POST = adminRoute<{ id: string }>(async ({ actor, params }) => ({
  ad: await duplicateAd(actor, params.id),
}));
