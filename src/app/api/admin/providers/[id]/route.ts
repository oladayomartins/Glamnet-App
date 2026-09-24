import { z } from "zod";
import { adminRoute } from "@/lib/api/admin-route";
import { setVendorFeatured } from "@/lib/server/admin/people";

/** PATCH /api/admin/providers/:id — promote or un-promote a live vendor. */
export const PATCH = adminRoute<{ id: string }>(async ({ actor, params, body }) => {
  const { isFeatured } = z.object({ isFeatured: z.boolean() }).parse(body);
  await setVendorFeatured(actor, params.id, isFeatured);
});
