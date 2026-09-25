import { NextResponse } from "next/server";
import { SignatureError, verifyStripeSignature } from "@/lib/api/stripe-signature";
import { handleStripeEvent } from "@/lib/server/stripe-webhooks";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/stripe — events from Stripe.
 *
 * Nothing is trusted until the signature checks out against
 * STRIPE_WEBHOOK_SECRET (the endpoint's signing secret, whsec_…). A bad
 * signature is a 400 and nothing is read from the body. A handler error is a
 * 500, so Stripe retries later.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    verifyStripeSignature(
      rawBody,
      request.headers.get("stripe-signature"),
      process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "",
    );
  } catch (error) {
    if (error instanceof SignatureError) {
      return NextResponse.json({ error: { code: "BAD_SIGNATURE", message: error.message } }, { status: 400 });
    }
    throw error;
  }

  let event: { id: string; type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Body is not JSON." } }, { status: 400 });
  }

  try {
    const handled = await handleStripeEvent(event);
    return NextResponse.json({ received: true, handled });
  } catch (error) {
    console.error("[stripe webhook] handler failed", event.type, event.id, error);
    return NextResponse.json({ error: { code: "HANDLER_FAILED", message: "Will retry." } }, { status: 500 });
  }
}
