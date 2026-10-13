import { z } from "zod";
import { adminRoute } from "@/lib/api/admin-route";
import { decideVendor } from "@/lib/server/admin/people";

const schema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "SUSPENDED", "PENDING"]),
  note: z.string().max(500).optional(),
});

/**
 * POST /api/admin/providers/:id/approval — approve, reject, suspend, or send
 * back to review. Approval is what sets `isVerified` and puts the storefront
 * live; documents are optional and reviewed alongside it when there are any.
 * Anything else takes the storefront offline.
 */
export const POST = adminRoute<{ id: string }>(async ({ actor, params, body }) => {
  const { decision, note } = schema.parse(body);
  await decideVendor(actor, params.id, decision, note ?? "");
});
