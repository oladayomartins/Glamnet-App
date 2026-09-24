import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { requireApiVendor } from "@/lib/auth/api-guard";
import { removeDocument } from "@/lib/server/provider-portal";

/** DELETE /api/provider/documents/:id — withdraw a document not yet approved. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const auth = await requireApiVendor();
    if ("response" in auth) return auth.response;
    const { documentId } = await params;
    await removeDocument(auth.providerId, documentId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
