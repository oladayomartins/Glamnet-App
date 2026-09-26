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
 * Stripe drops an uncaptured hold after about seven days, so a booking
 * further off saves the card instead (a SetupIntent on a Stripe Customer) and
 * the hold is placed off-session a few days before the appointment.
 *
 * Disputes are settled with a partial capture (before release) or a refund
 * plus a transfer reversal (after it).
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
    /** 0 for the first hold on a booking; each retry needs a fresh key. */
    attempt?: number;
  }): Promise<Authorisation>;
  authorisationState(paymentIntentId: string): Promise<AuthorisationState>;
  /**
   * Capture a hold and pay the vendor. `captureMinor` below the held amount
   * captures part of it (the rest goes back to the customer); a zero
   * `payoutMinor` captures without paying anyone.
   */
  captureAndTransfer(input: {
    bookingId: string;
    paymentIntentId: string;
    destinationAccountId: string;
    payoutMinor: number;
    captureMinor?: number;
  }): Promise<{ transferId: string }>;
  void(paymentIntentId: string): Promise<void>;

  /** The Stripe Customer a saved card belongs to, created on first use. */
  ensureCustomer(input: { customerId: string; email: string; name: string; existingId: string }): Promise<string>;
  /** Save a card for later (a SetupIntent), for bookings too far off to hold. */
  saveCard(input: { bookingId: string; stripeCustomerId: string; attempt?: number }): Promise<SavedCard>;
  savedCardState(setupIntentId: string): Promise<SavedCard>;
  /** Place a hold on a saved card, without the customer present. */
  authoriseSaved(input: {
    bookingId: string;
    amountMinor: number;
    stripeCustomerId: string;
    paymentMethodId: string;
    description: string;
    attempt: number;
  }): Promise<Authorisation & { failureReason: string }>;
  /** Refund part or all of a captured charge. */
  refund(input: { bookingId: string; paymentIntentId: string; amountMinor: number }): Promise<{ refundId: string }>;
  /** Take back part or all of what a vendor was transferred. */
  reverseTransfer(input: { bookingId: string; transferId: string; amountMinor: number }): Promise<{ reversalId: string }>;
}

export interface SavedCard {
  setupIntentId: string;
  clientSecret: string | null;
  state: "PENDING" | "SAVED" | "FAILED";
  paymentMethodId: string;
}

export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentError";
  }
}

// --- Stripe -------------------------------------------------------------

/** Overridable only so the Stripe paths can be exercised against a local stand-in. */
const STRIPE_API = process.env.STRIPE_API_BASE?.trim() || "https://api.stripe.com/v1";

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
    attempt?: number;
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
      input.attempt ? `hold-${input.bookingId}-${input.attempt}` : `hold-${input.bookingId}`,
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
    captureMinor?: number;
  }) {
    const captured = await this.call<{ latest_charge: string | null }>(
      "POST",
      `/payment_intents/${encodeURIComponent(input.paymentIntentId)}/capture`,
      input.captureMinor !== undefined ? { amount_to_capture: input.captureMinor } : {},
      `capture-${input.bookingId}`,
    );
    if (input.payoutMinor <= 0) return { transferId: "" };
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

  async ensureCustomer(input: { customerId: string; email: string; name: string; existingId: string }) {
    if (input.existingId) return input.existingId;
    const customer = await this.call<{ id: string }>(
      "POST",
      "/customers",
      { email: input.email, name: input.name, metadata: { customerId: input.customerId } },
      // Per attempt, like connected accounts: a fixed key would replay a
      // failure for 24 hours. The caller stores the id, so a customer is
      // created once in practice.
      `customer-${input.customerId}-${randomUUID()}`,
    );
    return customer.id;
  }

  async saveCard(input: { bookingId: string; stripeCustomerId: string; attempt?: number }): Promise<SavedCard> {
    const intent = await this.call<SetupIntentPayload>(
      "POST",
      "/setup_intents",
      {
        customer: input.stripeCustomerId,
        usage: "off_session",
        automatic_payment_methods: { enabled: true },
        metadata: { bookingId: input.bookingId },
      },
      input.attempt ? `setup-${input.bookingId}-${input.attempt}` : `setup-${input.bookingId}`,
    );
    return fromSetupIntent(intent);
  }

  async savedCardState(setupIntentId: string): Promise<SavedCard> {
    const intent = await this.call<SetupIntentPayload>(
      "GET",
      `/setup_intents/${encodeURIComponent(setupIntentId)}`,
    );
    return fromSetupIntent(intent);
  }

  async authoriseSaved(input: {
    bookingId: string;
    amountMinor: number;
    stripeCustomerId: string;
    paymentMethodId: string;
    description: string;
    attempt: number;
  }) {
    try {
      const intent = await this.call<{ id: string; status: string; last_payment_error?: { message?: string } }>(
        "POST",
        "/payment_intents",
        {
          amount: input.amountMinor,
          currency: "gbp",
          capture_method: "manual",
          customer: input.stripeCustomerId,
          payment_method: input.paymentMethodId,
          off_session: true,
          confirm: true,
          description: input.description,
          transfer_group: `booking_${input.bookingId}`,
          metadata: { bookingId: input.bookingId },
        },
        `hold-${input.bookingId}-${input.attempt}`,
      );
      return {
        paymentIntentId: intent.id,
        clientSecret: null,
        state: mapIntentStatus(intent.status),
        failureReason: intent.last_payment_error?.message ?? "",
      };
    } catch (error) {
      // A declined saved card is an answer, not a crash: the customer is asked
      // to put in another one.
      if (error instanceof PaymentError) {
        return { paymentIntentId: "", clientSecret: null, state: "FAILED" as const, failureReason: error.message };
      }
      throw error;
    }
  }

  async refund(input: { bookingId: string; paymentIntentId: string; amountMinor: number }) {
    const refund = await this.call<{ id: string }>(
      "POST",
      "/refunds",
      {
        payment_intent: input.paymentIntentId,
        amount: input.amountMinor,
        reason: "requested_by_customer",
        metadata: { bookingId: input.bookingId },
      },
      `refund-${input.bookingId}`,
    );
    return { refundId: refund.id };
  }

  async reverseTransfer(input: { bookingId: string; transferId: string; amountMinor: number }) {
    const reversal = await this.call<{ id: string }>(
      "POST",
      `/transfers/${encodeURIComponent(input.transferId)}/reversals`,
      { amount: input.amountMinor, metadata: { bookingId: input.bookingId } },
      `reversal-${input.bookingId}`,
    );
    return { reversalId: reversal.id };
  }
}

interface SetupIntentPayload {
  id: string;
  client_secret: string;
  status: string;
  payment_method: string | null;
}

function fromSetupIntent(intent: SetupIntentPayload): SavedCard {
  return {
    setupIntentId: intent.id,
    clientSecret: intent.client_secret,
    state:
      intent.status === "succeeded"
        ? "SAVED"
        : intent.status === "canceled"
          ? "FAILED"
          : "PENDING",
    paymentMethodId: intent.payment_method ?? "",
  };
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

  async authorise(input: { bookingId: string; attempt?: number }): Promise<Authorisation> {
    return {
      paymentIntentId: input.attempt ? `sim_pi_${input.bookingId}_${input.attempt}` : `sim_pi_${input.bookingId}`,
      clientSecret: null,
      state: "AUTHORISED",
    };
  }

  async authorisationState() {
    return "AUTHORISED" as const;
  }

  async captureAndTransfer(input: { bookingId: string; payoutMinor: number }) {
    return { transferId: input.payoutMinor > 0 ? `sim_tr_${input.bookingId}` : "" };
  }

  async void() {}

  async ensureCustomer(input: { customerId: string; existingId: string }) {
    return input.existingId || `sim_cus_${input.customerId}`;
  }

  async saveCard(input: { bookingId: string }): Promise<SavedCard> {
    return { setupIntentId: `sim_seti_${input.bookingId}`, clientSecret: null, state: "SAVED", paymentMethodId: "sim_pm_card" };
  }

  async savedCardState(setupIntentId: string): Promise<SavedCard> {
    return { setupIntentId, clientSecret: null, state: "SAVED", paymentMethodId: "sim_pm_card" };
  }

  async authoriseSaved(input: { bookingId: string; attempt: number }) {
    return {
      paymentIntentId: `sim_pi_${input.bookingId}_${input.attempt}`,
      clientSecret: null,
      state: "AUTHORISED" as const,
      failureReason: "",
    };
  }

  async refund(input: { bookingId: string }) {
    return { refundId: `sim_re_${input.bookingId}` };
  }

  async reverseTransfer(input: { bookingId: string }) {
    return { reversalId: `sim_trr_${input.bookingId}` };
  }
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
