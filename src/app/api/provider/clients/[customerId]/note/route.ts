import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { clientNoteSchema } from "@/lib/api/schemas";
import { requireApiVendor } from "@/lib/auth/api-guard";
import { saveClientNote } from "@/lib/server/clients";

/**
 * PUT /api/provider/clients/:customerId/note — the vendor's private note on
 * one of their clients. Only for someone they have actually had a booking
 * with; an empty note clears it.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ customerId: string }> }) {
  try {
    const auth = await requireApiVendor();
    if ("response" in auth) return auth.response;
    const { customerId } = await params;
    const { note } = clientNoteSchema.parse(await request.json());
    return NextResponse.json({ note: await saveClientNote(auth.providerId, customerId, note) });
  } catch (error) {
    return errorResponse(error);
  }
}
