import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { messageSchema } from "@/lib/api/schemas";
import { requireApiRole } from "@/lib/auth/api-guard";
import { partyOf } from "@/lib/api/booking-party";
import { listMessages, postMessage, type MessageViewer } from "@/lib/server/messages";

export const dynamic = "force-dynamic";

function viewerOf(user: Parameters<typeof partyOf>[0]): MessageViewer {
  return user.role === "ADMIN" ? { role: "ADMIN" } : partyOf(user);
}

/** GET /api/bookings/:id/messages — the thread, oldest first. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiRole(["CUSTOMER", "PROVIDER", "ADMIN"]);
    if ("response" in auth) return auth.response;
    const { id } = await params;
    return NextResponse.json(await listMessages(id, viewerOf(auth.user)));
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/bookings/:id/messages — the client or vendor writes a message. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiRole(["CUSTOMER", "PROVIDER"]);
    if ("response" in auth) return auth.response;
    const { id } = await params;
    const { body } = messageSchema.parse(await request.json());
    const message = await postMessage(id, partyOf(auth.user), body);
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
