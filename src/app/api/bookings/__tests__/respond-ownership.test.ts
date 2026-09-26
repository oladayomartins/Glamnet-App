import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth/session";

const mocks = vi.hoisted(() => ({
  user: null as unknown as SessionUser,
  acceptBooking: vi.fn(),
  declineBroadcast: vi.fn(),
}));

vi.mock("@/lib/auth/api-guard", () => ({
  requireApiRole: async () => ({ user: mocks.user }),
}));
vi.mock("@/lib/server/booking-service", () => ({ acceptBooking: mocks.acceptBooking }));
vi.mock("@/lib/server/payment-flow", () => ({ declineBroadcast: mocks.declineBroadcast }));

const accept = await import("../[id]/accept/route");
const decline = await import("../[id]/decline/route");

const vendor = (providerId: string, role: SessionUser["role"] = "PROVIDER"): SessionUser => ({
  appUserId: "app-1",
  authUserId: "auth-1",
  email: "vendor@example.com",
  name: "Vendor",
  avatarUrl: "",
  role,
  customerId: null,
  providerId,
  providerApproved: true,
});

const call = (
  route: typeof accept | typeof decline,
  providerId: string,
) =>
  route.POST(
    new Request("http://test/api/bookings/b1", {
      method: "POST",
      body: JSON.stringify({ providerId }),
    }),
    { params: Promise.resolve({ id: "b1" }) },
  );

describe.each([
  ["accept", accept, () => mocks.acceptBooking],
  ["decline", decline, () => mocks.declineBroadcast],
] as const)("POST /api/bookings/:id/%s", (_name, route, service) => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.acceptBooking.mockResolvedValue({ id: "b1" });
    mocks.declineBroadcast.mockResolvedValue(undefined);
  });

  it("refuses a vendor answering for somebody else", async () => {
    mocks.user = vendor("provider-a");
    const response = await call(route, "provider-b");
    expect(response.status).toBe(403);
    expect(service()).not.toHaveBeenCalled();
  });

  it("lets a vendor answer for themselves", async () => {
    mocks.user = vendor("provider-a");
    const response = await call(route, "provider-a");
    expect(response.status).toBe(200);
    expect(service()).toHaveBeenCalledWith("b1", "provider-a");
  });

  it("lets an admin answer for a vendor", async () => {
    mocks.user = { ...vendor("", "ADMIN"), providerId: null };
    const response = await call(route, "provider-b");
    expect(response.status).toBe(200);
  });
});
