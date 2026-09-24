import { z } from "zod";
import { adminRoute } from "@/lib/api/admin-route";
import { decideVendor } from "@/lib/server/admin/people";

const schema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "SUSPENDED", "PENDING"]),
  note: z.string().max(500).optional(),
});

/**
 * POST /api/admin/providers/:id/approval — approve, reject, suspend, or send
 * back to review. Approval is the compliance gate (Directory §C): it needs a
 * document on file, and it is what sets `isVerified` and puts the storefront
 * live. Anything else takes the storefront offline.
 */
export const POST = adminRoute<{ id: string }>(async ({ actor, params, body }) => {
  const { decision, note } = schema.parse(body);
  await decideVendor(actor, params.id, decision, note ?? "");
});
