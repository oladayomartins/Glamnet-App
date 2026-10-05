import { adminRoute } from "@/lib/api/admin-route";
import { reviewDocument } from "@/lib/server/admin/people";

/** PATCH /api/admin/providers/:id/documents/:documentId — review one document. */
export const PATCH = adminRoute<{ id: string; documentId: string }>(async ({ actor, params, body }) => ({
  document: await reviewDocument(actor, params.id, params.documentId, body),
}));
