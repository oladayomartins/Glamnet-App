import { adminRoute } from "@/lib/api/admin-route";
import { deleteService, updateService } from "@/lib/server/admin/catalogue";

/** PATCH /api/admin/services/:id — edit, hide or restore a service. */
export const PATCH = adminRoute<{ id: string }>(async ({ actor, params, body }) => ({
  service: await updateService(actor, params.id, body),
}));

/** DELETE /api/admin/services/:id — only for a service that has never been booked. */
export const DELETE = adminRoute<{ id: string }>(async ({ actor, params }) => {
  await deleteService(actor, params.id);
});
