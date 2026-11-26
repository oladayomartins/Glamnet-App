import { adminRoute } from "@/lib/api/admin-route";
import { replyToEnquiry } from "@/lib/server/support";

/** POST /api/admin/support/:id/reply — email the sender a reply, and keep it on the enquiry. */
export const POST = adminRoute<{ id: string }>(async ({ actor, params, body }) => replyToEnquiry(actor, params.id, body));
