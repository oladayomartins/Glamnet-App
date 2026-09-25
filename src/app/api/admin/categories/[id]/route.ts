import { adminRoute } from "@/lib/api/admin-route";
import { deleteCategory, updateCategory } from "@/lib/server/admin/catalogue";

export const PATCH = adminRoute<{ id: string }>(async ({ actor, params, body }) => ({
  category: await updateCategory(actor, params.id, body),
}));

/** DELETE /api/admin/categories/:id[?moveTo=Name] — services move to `moveTo` first. */
export const DELETE = adminRoute<{ id: string }>(async ({ actor, params, request }) => {
  await deleteCategory(actor, params.id, new URL(request.url).searchParams.get("moveTo"));
});
