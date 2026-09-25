import { adminRoute } from "@/lib/api/admin-route";
import { deleteCity, updateCity } from "@/lib/server/admin/cities";

export const PATCH = adminRoute<{ id: string }>(async ({ actor, params, body }) => ({
  city: await updateCity(actor, params.id, body),
}));

export const DELETE = adminRoute<{ id: string }>(async ({ actor, params }) => {
  await deleteCity(actor, params.id);
});
