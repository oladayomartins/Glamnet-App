import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { acceptSchema } from "@/lib/api/schemas";
import { declineBroadcast } from "@/lib/server/payment-flow";
import { requireApiRole } from "@/lib/auth/api-guard";
import { requireOwnProvider } from "@/lib/auth/provider-guard";

/**
 * POST /api/bookings/:id/decline — a vendor turns a request down.
 *
 * Takes the same body as accept. A vendor may only decline for themselves:
 * without the ownership check, anyone signed in as a vendor could clear a
 * competitor's inbox.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiRole(["PROVIDER", "ADMIN"]);
    if ("response" in auth) return auth.response;

    const { id } = await params;
    const { providerId } = acceptSchema.parse(await request.json());
    const denied = requireOwnProvider(auth.user, providerId);
    if (denied) return denied;

    await declineBroadcast(id, providerId);
    return NextResponse.json({ declined: true });
  } catch (error) {
    return errorResponse(error);
  }
}
