import { adminRoute } from "@/lib/api/admin-route";
import { deleteCategory, updateCategory } from "@/lib/server/admin/catalogue";

export const PATCH = adminRoute<{ id: string }>(async ({ actor, params, body }) => ({
  category: await updateCategory(actor, params.id, body),
}));

export const DELETE = adminRoute<{ id: string }>(async ({ actor, params }) => {
  await deleteCategory(actor, params.id);
});
