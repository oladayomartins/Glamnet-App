import { adminRoute } from "@/lib/api/admin-route";
import { updateService } from "@/lib/server/admin/catalogue";

/** PATCH /api/admin/services/:id — edit, hide or restore a service. */
export const PATCH = adminRoute<{ id: string }>(async ({ actor, params, body }) => ({
  service: await updateService(actor, params.id, body),
}));
