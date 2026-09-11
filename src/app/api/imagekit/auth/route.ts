import { NextResponse } from "next/server";
import { getUploadAuthParams } from "@imagekit/next/server";
import { errorResponse } from "@/lib/api/respond";
import { requireApiRole } from "@/lib/auth/api-guard";
import { imageKitPublicKey, isImageKitConfigured } from "@/lib/imagekit";

export const dynamic = "force-dynamic";

/**
 * GET /api/imagekit/auth — short-lived credentials for a direct browser upload.
 *
 * Sign-in is required. This endpoint is the only thing standing between the
 * public internet and write access to the media library: an unauthenticated
 * version is an open upload endpoint on a paid account, and anyone who found
 * it could fill the library with arbitrary files at GLAMNET's expense.
 *
 * The private key is used to sign here and never leaves the server. What the
 * browser receives is a token, a signature and an expiry — enough to upload
 * once, shortly, and nothing more.
 */
export async function GET() {
  try {
    // Any signed-in account may upload: customers attach reference images,
    // providers their portfolio. Role is enforced per surface, not here.
    const auth = await requireApiRole(["CUSTOMER", "PROVIDER", "ADMIN"]);
    if ("response" in auth) return auth.response;

    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY?.trim();
    const publicKey = imageKitPublicKey();

    if (!isImageKitConfigured() || !privateKey || !publicKey) {
      return NextResponse.json(
        {
          error: {
            code: "IMAGEKIT_NOT_CONFIGURED",
            message: "Image uploads are not available on this deployment.",
          },
        },
        { status: 503 },
      );
    }

    // Ten minutes is long enough to pick a photo and upload it, short enough
    // that a leaked token is not worth reusing.
    const expire = Math.floor(Date.now() / 1000) + 10 * 60;
    const { token, signature, expire: expiresAt } = getUploadAuthParams({
      privateKey,
      publicKey,
      expire,
    });

    return NextResponse.json({
      token,
      signature,
      expire: expiresAt,
      publicKey,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
