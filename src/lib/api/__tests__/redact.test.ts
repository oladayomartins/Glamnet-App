import { describe, expect, it } from "vitest";
import { forVendor, withoutPin } from "@/lib/api/redact";

const booking = {
  id: "b1",
  completionPin: "4821",
  addressLine: "42 Secret Lane, S11 8XX",
  addressUnlocked: false,
  customer: { name: "Jade", email: "jade@example.test", phone: "07700 900123", stripeCustomerId: "cus_1" },
  broadcasts: [
    { providerId: "p1", status: "ACCEPTED" },
    { providerId: "p2", status: "EXPIRED" },
  ],
};

describe("forVendor", () => {
  it("masks the PIN, as withoutPin does", () => {
    expect(forVendor(booking, "p1").completionPin).toBe("••••");
    expect(withoutPin(booking).completionPin).toBe("••••");
  });

  it("withholds the address until it is unlocked", () => {
    expect(forVendor(booking, "p1").addressLine).toBe("");
    expect(forVendor({ ...booking, addressUnlocked: true }, "p1").addressLine).toBe(booking.addressLine);
  });

  it("reduces the client to their name", () => {
    expect(forVendor(booking, "p1").customer).toEqual({ name: "Jade" });
  });

  it("shows a vendor only their own broadcast offer", () => {
    expect(forVendor(booking, "p1").broadcasts).toEqual([{ providerId: "p1", status: "ACCEPTED" }]);
  });

  it("leaves fields a booking does not carry alone", () => {
    const bare = forVendor({ id: "b2", completionPin: "" }, "p1");
    expect(bare).toEqual({ id: "b2", completionPin: "" });
  });
});
