import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { errorResponse } from "@/lib/api/respond";
import { requireApiRole } from "@/lib/auth/api-guard";

/**
 * Saving a vendor.
 *
 * PUT saves, DELETE unsaves. Both are idempotent, which is the point of the
 * composite primary key: a double-tap, an optimistic retry or a second device
 * all land on the same row rather than a duplicate or a 409.
 *
 * Customers only. A vendor's own saved list would mean nothing, and an
 * unauthenticated save has nowhere to live.
 */
async function customer() {
  const auth = await requireApiRole(["CUSTOMER"]);
  if ("response" in auth) return auth;
  if (!auth.user.customerId) {
    return {
      response: NextResponse.json(
        { error: { message: "Only customers can save vendors." } },
        { status: 403 },
      ),
    };
  }
  return { customerId: auth.user.customerId };
}

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ providerId: string }> },
) {
  try {
    const auth = await customer();
    if ("response" in auth) return auth.response;
    const { providerId } = await params;

    // upsert rather than create: saving something already saved is a success,
    // not a constraint violation the client has to interpret.
    await prisma.savedVendor.upsert({
      where: {
        customerId_providerId: { customerId: auth.customerId, providerId },
      },
      create: { customerId: auth.customerId, providerId },
      update: {},
    });

    return NextResponse.json({ saved: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ providerId: string }> },
) {
  try {
    const auth = await customer();
    if ("response" in auth) return auth.response;
    const { providerId } = await params;

    // deleteMany, not delete: removing something already removed is a success.
    await prisma.savedVendor.deleteMany({
      where: { customerId: auth.customerId, providerId },
    });

    return NextResponse.json({ saved: false });
  } catch (error) {
    return errorResponse(error);
  }
}
