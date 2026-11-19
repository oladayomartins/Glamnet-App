import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Guard rails on the simulated gateway.
 *
 * The failure these cover is silent: a production deployment with no Stripe key
 * takes bookings, shows them as paid and settles escrow without a penny
 * moving. There is no error to notice, so the test is the notice.
 */

const KEYS = [
  "STRIPE_SECRET_KEY",
  "VERCEL_ENV",
  "ALLOW_SIMULATED_PAYMENTS",
] as const;

function setEnv(values: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const key of KEYS) {
    const value = values[key];
    if (value === undefined) vi.stubEnv(key, "");
    else vi.stubEnv(key, value);
  }
}

/** Fresh module each time: the gateway is memoised at module scope. */
async function load() {
  vi.resetModules();
  return import("../payments");
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("simulatedPaymentsAllowed", () => {
  it("allows simulation anywhere that is not production", async () => {
    for (const env of ["", "preview", "development"]) {
      setEnv({ VERCEL_ENV: env });
      const { simulatedPaymentsAllowed } = await load();
      expect(simulatedPaymentsAllowed()).toBe(true);
    }
  });

  it("refuses simulation in production by default", async () => {
    setEnv({ VERCEL_ENV: "production" });
    const { simulatedPaymentsAllowed } = await load();
    expect(simulatedPaymentsAllowed()).toBe(false);
  });

  it("allows simulation in production only when asked for explicitly", async () => {
    setEnv({ VERCEL_ENV: "production", ALLOW_SIMULATED_PAYMENTS: "1" });
    const { simulatedPaymentsAllowed } = await load();
    expect(simulatedPaymentsAllowed()).toBe(true);
  });

  it("is not fooled by a truthy-looking value", async () => {
    for (const value of ["0", "true", "yes", "false"]) {
      setEnv({ VERCEL_ENV: "production", ALLOW_SIMULATED_PAYMENTS: value });
      const { simulatedPaymentsAllowed } = await load();
      expect(simulatedPaymentsAllowed()).toBe(value === "1");
    }
  });
});

describe("paymentsMisconfigured", () => {
  it("is true on a production deployment with no key and no opt-in", async () => {
    setEnv({ VERCEL_ENV: "production" });
    const { paymentsMisconfigured } = await load();
    expect(paymentsMisconfigured()).toBe(true);
  });

  it("is false once a Stripe key is present", async () => {
    setEnv({ VERCEL_ENV: "production", STRIPE_SECRET_KEY: "sk_live_x" });
    const { paymentsMisconfigured } = await load();
    expect(paymentsMisconfigured()).toBe(false);
  });

  it("is false on a deliberate demo deployment", async () => {
    setEnv({ VERCEL_ENV: "production", ALLOW_SIMULATED_PAYMENTS: "1" });
    const { paymentsMisconfigured } = await load();
    expect(paymentsMisconfigured()).toBe(false);
  });

  it("is false in development with no key at all", async () => {
    setEnv({});
    const { paymentsMisconfigured } = await load();
    expect(paymentsMisconfigured()).toBe(false);
  });
});

describe("paymentGateway", () => {
  it("uses Stripe when a key is set", async () => {
    setEnv({ VERCEL_ENV: "production", STRIPE_SECRET_KEY: "sk_live_x" });
    const { paymentGateway } = await load();
    expect(paymentGateway().mode).toBe("stripe");
  });

  it("simulates in development", async () => {
    setEnv({});
    const { paymentGateway } = await load();
    expect(paymentGateway().mode).toBe("simulated");
  });

  it("refuses to simulate in production, and says what to do", async () => {
    setEnv({ VERCEL_ENV: "production" });
    const { paymentGateway } = await load();
    expect(() => paymentGateway()).toThrowError(/STRIPE_SECRET_KEY/);
    expect(() => paymentGateway()).toThrowError(/ALLOW_SIMULATED_PAYMENTS/);
  });

  it("simulates in production when that is the deliberate choice", async () => {
    setEnv({ VERCEL_ENV: "production", ALLOW_SIMULATED_PAYMENTS: "1" });
    const { paymentGateway } = await load();
    expect(paymentGateway().mode).toBe("simulated");
  });
});
