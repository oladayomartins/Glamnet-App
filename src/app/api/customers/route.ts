import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";
import { requireApiRole } from "@/lib/auth/api-guard";

/**
 * GET /api/customers — admin only.
 *
 * This began as a demo picker feeding a dropdown on the checkout. It returns
 * names and email addresses, so with real accounts it becomes a customer list
 * and is restricted accordingly.
 */
export async function GET() {
  try {
    const auth = await requireApiRole(["ADMIN"]);
    if ("response" in auth) return auth.response;

    const customers = await prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    });
    return NextResponse.json({ customers });
  } catch (error) {
    return errorResponse(error);
  }
}
