import { z } from "zod";
import { adminRoute } from "@/lib/api/admin-route";
import { setAccountSuspended } from "@/lib/server/admin/people";

/** PATCH /api/admin/accounts/:id — suspend or reinstate a login. */
export const PATCH = adminRoute<{ id: string }>(async ({ actor, params, body }) => {
  const { suspended, reason } = z
    .object({ suspended: z.boolean(), reason: z.string().trim().max(300).optional() })
    .parse(body);
  await setAccountSuspended(actor, params.id, suspended, reason ?? "");
});
