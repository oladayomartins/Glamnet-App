import { describe, expect, it } from "vitest";
import { requireOwnProvider } from "../provider-guard";
import type { SessionUser } from "../session";

const user = (overrides: Partial<SessionUser> = {}): SessionUser => ({
  appUserId: "app-1",
  authUserId: "auth-1",
  email: "someone@example.com",
  role: "PROVIDER",
  customerId: null,
  providerId: "provider-1",
  providerApproved: true,
  ...overrides,
});

describe("requireOwnProvider", () => {
  it("lets a provider act on themselves", () => {
    expect(requireOwnProvider(user(), "provider-1")).toBeNull();
  });

  it("stops a provider acting on somebody else", () => {
    const denied = requireOwnProvider(user(), "provider-2");
    expect(denied?.status).toBe(403);
  });

  it("lets an admin act on anyone", () => {
    const admin = user({ role: "ADMIN", providerId: null });
    expect(requireOwnProvider(admin, "provider-2")).toBeNull();
  });

  it("stops a customer, who has no provider id at all", () => {
    // The null-vs-null case: a customer must not pass by matching a provider
    // whose id happens also to be absent.
    const customer = user({ role: "CUSTOMER", providerId: null });
    expect(requireOwnProvider(customer, "provider-1")?.status).toBe(403);
  });
});
