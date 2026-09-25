import { createHmac, timingSafeEqual } from "node:crypto";

/** How old a signed webhook may be, in seconds (Stripe's own default). */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export class SignatureError extends Error {}

/**
 * Check a Stripe webhook's `Stripe-Signature` header against the raw body.
 *
 * The header is `t=<unix time>,v1=<hex HMAC-SHA256 of "t.body">[,v1=…]`,
 * signed with the endpoint's signing secret. Several v1 values appear while
 * a secret is being rolled; any one matching is enough. The timestamp bounds
 * replays of an old, captured request.
 *
 * Done by hand rather than with the Stripe SDK, which this app doesn't ship.
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  now = Date.now(),
): void {
  if (!secret) throw new SignatureError("Webhook signing secret is not configured.");
  if (!header) throw new SignatureError("Missing Stripe-Signature header.");

  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.split("=", 2).map((piece) => piece?.trim() ?? "");
    if (key === "t") timestamp = value;
    if (key === "v1" && value) signatures.push(value);
  }
  if (!/^\d+$/.test(timestamp) || signatures.length === 0) {
    throw new SignatureError("Malformed Stripe-Signature header.");
  }
  if (Math.abs(now / 1_000 - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) {
    throw new SignatureError("Webhook timestamp is outside the tolerance.");
  }

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest();
  const matches = signatures.some((signature) => {
    if (!/^[0-9a-f]+$/i.test(signature) || signature.length !== expected.length * 2) return false;
    return timingSafeEqual(Buffer.from(signature, "hex"), expected);
  });
  if (!matches) throw new SignatureError("Webhook signature does not match.");
}

/** Sign a body the way Stripe does — for tests and local replays. */
export function signStripePayload(rawBody: string, secret: string, timestamp: number): string {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  return `t=${timestamp},v1=${signature}`;
}
