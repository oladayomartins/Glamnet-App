import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/auth/session";
import { submitEnquiry } from "@/lib/server/support";

/** POST /api/support — the contact form. Open to everyone, signed in or not. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const user = await getSessionUser().catch(() => null);
    const result = await submitEnquiry(body, user?.appUserId ?? null);
    if (!result.ok) {
      return NextResponse.json({ error: { code: "REJECTED", message: result.message } }, { status: result.status });
    }
    return NextResponse.json({ reference: result.reference });
  } catch (error) {
    return errorResponse(error);
  }
}
