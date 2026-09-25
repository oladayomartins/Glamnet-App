import { describe, expect, it } from "vitest";
import { signStripePayload, verifyStripeSignature } from "../stripe-signature";

const secret = "whsec_test_secret";
const body = JSON.stringify({ id: "evt_1", type: "payment_intent.canceled" });
const now = 1_790_000_000_000;
const t = Math.floor(now / 1_000);

describe("verifyStripeSignature", () => {
  it("accepts a correctly signed, fresh payload", () => {
    expect(() => verifyStripeSignature(body, signStripePayload(body, secret, t), secret, now)).not.toThrow();
  });

  it("accepts when any one of several signatures matches (secret rollover)", () => {
    const good = signStripePayload(body, secret, t).split(",")[1];
    const header = `t=${t},v1=${"0".repeat(64)},${good}`;
    expect(() => verifyStripeSignature(body, header, secret, now)).not.toThrow();
  });

  it("rejects a tampered body, a wrong secret, or a stale timestamp", () => {
    const header = signStripePayload(body, secret, t);
    expect(() => verifyStripeSignature(body.replace("evt_1", "evt_2"), header, secret, now)).toThrow(/does not match/);
    expect(() => verifyStripeSignature(body, header, "whsec_other", now)).toThrow(/does not match/);
    expect(() => verifyStripeSignature(body, header, secret, now + 301_000)).toThrow(/tolerance/);
  });

  it("rejects missing or malformed headers and a missing secret", () => {
    expect(() => verifyStripeSignature(body, null, secret, now)).toThrow(/Missing/);
    expect(() => verifyStripeSignature(body, "v1=abc", secret, now)).toThrow(/Malformed/);
    expect(() => verifyStripeSignature(body, `t=${t},v1=zz`, secret, now)).toThrow(/does not match/);
    expect(() => verifyStripeSignature(body, signStripePayload(body, secret, t), "", now)).toThrow(/not configured/);
  });
});
