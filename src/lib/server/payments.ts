/**
 * Payment gateway (Open Marketplace Directory §D — Stripe Connect engine).
 *
 * Model: separate charges and transfers.
 *
 *   checkout  → a PaymentIntent with capture_method=manual on the platform
 *               account: a pre-authorisation hold, nothing taken yet.
 *   PIN match → capture the hold, then Transfer the vendor's payout to their
 *               Express connected account, tied to the charge with
 *               source_transaction so it cannot outrun the funds.
 *   cancel    → cancel the PaymentIntent, releasing the hold.
 *
 * Separate transfers rather than a destination charge because an emergency
 * broadcast is authorised before any vendor has accepted: there is no
 * destination to name at checkout. One model serves both flows.
 *
 * Stripe is called over its REST API with fetch rather than the SDK, to keep
 * the serverless bundle small. With no STRIPE_SECRET_KEY set, a simulated
 * gateway stands in: every hold "succeeds" instantly and no money moves. The
 * UI labels that mode as a test so it can never be mistaken for a charge.
 */
import { randomUUID } from "node:crypto";

export type PaymentMode = "stripe" | "simulated";

export type AuthorisationState =
  | "PENDING_AUTHORISATION"
  | "AUTHORISED"
  | "FAILED"
  | "VOIDED"
  | "CAPTURED";

export interface Authorisation {
  paymentIntentId: string;
  /** For Stripe.js to confirm the card in the browser. Null when simulated. */
  clientSecret: string | null;
  state: AuthorisationState;
}

export interface PaymentGateway {
  readonly mode: PaymentMode;
  createConnectedAccount(input: { email: string; providerId: string }): Promise<string>;
  createOnboardingLink(input: {
    accountId: string;
    refreshUrl: string;
    returnUrl: string;
  }): Promise<string>;
  payoutsEnabled(accountId: string): Promise<boolean>;
  authorise(input: {
    bookingId: string;
    amountMinor: number;
    customerEmail: string;
    description: string;
  }): Promise<Authorisation>;
  authorisationState(paymentIntentId: string): Promise<AuthorisationState>;
  captureAndTransfer(input: {
    bookingId: string;
    paymentIntentId: string;
    destinationAccountId: string;
    payoutMinor: number;
  }): Promise<{ transferId: string }>;
  void(paymentIntentId: string): Promise<void>;
}

export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentError";
  }
}

// --- Stripe -------------------------------------------------------------

const STRIPE_API = "https://api.stripe.com/v1";

/** Flatten nested params into Stripe's form encoding: a[b]=c. */
function encodeForm(params: Record<string, unknown>, prefix = ""): string[] {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === "object" && !Array.isArray(value)) {
      parts.push(...encodeForm(value as Record<string, unknown>, name));
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        parts.push(`${encodeURIComponent(`${name}[${index}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else {
      parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts;
}

class StripeGateway implements PaymentGateway {
  readonly mode = "stripe" as const;

  constructor(private readonly secretKey: string) {}

  private async call<T>(
    method: "GET" | "POST",
    path: string,
    params: Record<string, unknown> = {},
    idempotencyKey?: string,
  ): Promise<T> {
    const body = encodeForm(params).join("&");
    const url = method === "GET" && body ? `${STRIPE_API}${path}?${body}` : `${STRIPE_API}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${this.secretKey}`,
        // Pinned so response shapes (e.g. latest_charge on a capture) do not
        // shift with the account's default API version.
        "stripe-version": "2024-06-20",
        "content-type": "application/x-www-form-urlencoded",
        // Retrying a request that timed out must not place a second hold or
        // pay a vendor twice.
        ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
      },
      body: method === "POST" ? body : undefined,
      cache: "no-store",
    });
    const payload = (await response.json()) as T & {
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new PaymentError(payload.error?.message ?? `Stripe returned ${response.status}.`);
    }
    return payload;
  }

  async createConnectedAccount(input: { email: string; providerId: string }) {
    const account = await this.call<{ id: string }>(
      "POST",
      "/accounts",
      {
        type: "express",
        country: "GB",
        email: input.email,
        business_type: "individual",
        capabilities: { transfers: { requested: true } },
        metadata: { providerId: input.providerId },
      },
      // Unique per attempt. Stripe replays whatever it first answered to a
      // key for 24 hours, errors included, so a fixed per-vendor key would
      // keep returning a refusal (e.g. from before Connect was enabled) long
      // after the cause is fixed. Duplicates are prevented by the caller
      // checking and claiming stripeAccountId instead.
      `account-${input.providerId}-${randomUUID()}`,
    );
    return account.id;
  }

  async createOnboardingLink(input: {
    accountId: string;
    refreshUrl: string;
    returnUrl: string;
  }) {
    const link = await this.call<{ url: string }>("POST", "/account_links", {
      account: input.accountId,
      refresh_url: input.refreshUrl,
      return_url: input.returnUrl,
      type: "account_onboarding",
    });
    return link.url;
  }

  async payoutsEnabled(accountId: string) {
    const account = await this.call<{ payouts_enabled?: boolean }>(
      "GET",
      `/accounts/${encodeURIComponent(accountId)}`,
    );
    return Boolean(account.payouts_enabled);
  }

  async authorise(input: {
    bookingId: string;
    amountMinor: number;
    customerEmail: string;
    description: string;
  }): Promise<Authorisation> {
    const intent = await this.call<{ id: string; client_secret: string; status: string }>(
      "POST",
      "/payment_intents",
      {
        amount: input.amountMinor,
        currency: "gbp",
        capture_method: "manual",
        automatic_payment_methods: { enabled: true },
        receipt_email: input.customerEmail,
        description: input.description,
        // Groups the charge and its later transfer in the Stripe dashboard.
        transfer_group: `booking_${input.bookingId}`,
        metadata: { bookingId: input.bookingId },
      },
      `hold-${input.bookingId}`,
    );
    return {
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      state: mapIntentStatus(intent.status),
    };
  }

  async authorisationState(paymentIntentId: string) {
    const intent = await this.call<{ status: string }>(
      "GET",
      `/payment_intents/${encodeURIComponent(paymentIntentId)}`,
    );
    return mapIntentStatus(intent.status);
  }

  async captureAndTransfer(input: {
    bookingId: string;
    paymentIntentId: string;
    destinationAccountId: string;
    payoutMinor: number;
  }) {
    const captured = await this.call<{ latest_charge: string | null }>(
      "POST",
      `/payment_intents/${encodeURIComponent(input.paymentIntentId)}/capture`,
      {},
      `capture-${input.bookingId}`,
    );
    const transfer = await this.call<{ id: string }>(
      "POST",
      "/transfers",
      {
        amount: input.payoutMinor,
        currency: "gbp",
        destination: input.destinationAccountId,
        transfer_group: `booking_${input.bookingId}`,
        source_transaction: captured.latest_charge ?? undefined,
        metadata: { bookingId: input.bookingId },
      },
      `transfer-${input.bookingId}`,
    );
    return { transferId: transfer.id };
  }

  async void(paymentIntentId: string) {
    await this.call(
      "POST",
      `/payment_intents/${encodeURIComponent(paymentIntentId)}/cancel`,
    );
  }
}

function mapIntentStatus(status: string): AuthorisationState {
  switch (status) {
    case "requires_capture":
      return "AUTHORISED";
    case "succeeded":
      return "CAPTURED";
    case "canceled":
      return "VOIDED";
    case "requires_payment_method":
    case "requires_confirmation":
    case "requires_action":
    case "processing":
      return "PENDING_AUTHORISATION";
    default:
      return "FAILED";
  }
}

// --- Simulated ------------------------------------------------------------

class SimulatedGateway implements PaymentGateway {
  readonly mode = "simulated" as const;

  async createConnectedAccount(input: { providerId: string }) {
    return `sim_acct_${input.providerId}`;
  }

  async createOnboardingLink(input: { returnUrl: string }) {
    // Straight back: there is no bank form to fill in on a test deployment.
    return input.returnUrl;
  }

  async payoutsEnabled() {
    return true;
  }

  async authorise(input: { bookingId: string }): Promise<Authorisation> {
    return {
      paymentIntentId: `sim_pi_${input.bookingId}`,
      clientSecret: null,
      state: "AUTHORISED",
    };
  }

  async authorisationState() {
    return "AUTHORISED" as const;
  }

  async captureAndTransfer(input: { bookingId: string }) {
    return { transferId: `sim_tr_${input.bookingId}` };
  }

  async void() {}
}

let gateway: PaymentGateway | null = null;

export function paymentGateway(): PaymentGateway {
  if (!gateway) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    gateway = key ? new StripeGateway(key) : new SimulatedGateway();
  }
  return gateway;
}

/** The browser needs the publishable key to mount Stripe Elements. */
export function stripePublishableKey(): string | null {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || null;
}
