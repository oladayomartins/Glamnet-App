import { z } from "zod";
import { adminRoute } from "@/lib/api/admin-route";
import { prisma } from "@/lib/server/prisma";
import { AdminError, audit } from "@/lib/server/admin/core";

const schema = z.object({ status: z.enum(["OPEN", "RESOLVED"]) });

/** POST /api/admin/support/:id — mark a support enquiry resolved, or reopen it. */
export const POST = adminRoute<{ id: string }>(async ({ actor, params, body }) => {
  const { status } = schema.parse(body);
  const enquiry = await prisma.supportEnquiry.findUnique({ where: { id: params.id } });
  if (!enquiry) throw new AdminError("That enquiry no longer exists.", 404, "NOT_FOUND");
  await prisma.supportEnquiry.update({
    where: { id: params.id },
    data:
      status === "RESOLVED"
        ? { status, resolvedAt: new Date(), resolvedBy: actor }
        : { status, resolvedAt: null, resolvedBy: "" },
  });
  await audit(actor, `support.${status.toLowerCase()}`, { type: "SupportEnquiry", id: params.id }, enquiry.reference);
});
