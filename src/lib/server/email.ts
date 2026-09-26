import { Resend } from "resend";
import type { EmailBody } from "@/lib/email/templates";

/**
 * Email delivery (Resend).
 *
 * Three rules this module exists to enforce:
 *
 *  1. **Email is never load-bearing.** Nothing here throws. A booking that was
 *     written to the database is a real booking whether or not the mail went
 *     out, so a Resend outage must degrade to "no email" and never to a failed
 *     request or — far worse — a rolled-back transaction. Callers get a result
 *     object they are free to ignore.
 *  2. **Unconfigured is a supported state.** With no RESEND_API_KEY the app
 *     runs exactly as before this integration existed. That keeps local
 *     development, CI and preview deploys from mailing anyone, and it is why
 *     the client is created lazily rather than at module load.
 *  3. **The key lives in the environment.** It is read from process.env and
 *     never from source, so it can be rotated in the host's dashboard without
 *     a deploy and is never committed.
 */

export interface EmailMessage extends EmailBody {
  to: string;
}

export type EmailResult =
  | { ok: true; sent: number }
  | { ok: false; reason: "NOT_CONFIGURED" | "NO_RECIPIENTS" | "SEND_FAILED" };

/** Resend accepts at most 100 messages in one batch call. */
const BATCH_LIMIT = 100;

let client: Resend | null = null;

function apiKey(): string {
  return process.env.RESEND_API_KEY?.trim() ?? "";
}

/**
 * The From header.
 *
 * Must be an address on a domain verified in Resend. Resend's shared sandbox
 * sender (onboarding@resend.dev) only delivers to the account owner's own
 * address, so it is fine for a smoke test and useless in production — which is
 * why this is configuration rather than a default baked into the code.
 */
function fromAddress(): string {
  return process.env.RESEND_FROM?.trim() || "GLAMNET <bookings@glamnetapp.com>";
}

/** True when email can actually be delivered. */
export function isEmailConfigured(): boolean {
  return apiKey().length > 0;
}

function getClient(): Resend | null {
  const key = apiKey();
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

/**
 * Send one or more messages.
 *
 * Note the SDK's contract: `send` and `batch.send` resolve with
 * `{ data, error }` and do **not** reject on an API error. Checking only for a
 * thrown exception would report every rejected send as a success, so the
 * returned `error` is inspected explicitly — and the network-level `catch` is
 * still needed on top of it, for DNS and timeouts.
 */
export async function sendEmails(messages: EmailMessage[]): Promise<EmailResult> {
  const deliverable = messages.filter((message) => message.to.includes("@"));
  if (deliverable.length === 0) return { ok: false, reason: "NO_RECIPIENTS" };

  const resend = getClient();
  if (!resend) return { ok: false, reason: "NOT_CONFIGURED" };

  const from = fromAddress();
  const payload = deliverable.map((message) => ({
    from,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    ...(message.headers ? { headers: message.headers } : {}),
  }));

  // Resend takes at most 100 per batch, so a campaign to a bigger audience
  // goes out in several. A batch that fails part-way reports what did send,
  // so the caller never treats a half-sent campaign as unsent and repeats it.
  let sent = 0;
  for (let start = 0; start < payload.length; start += BATCH_LIMIT) {
    const batch = payload.slice(start, start + BATCH_LIMIT);
    try {
      const { error } = await resend.batch.send(batch);
      if (error) {
        console.error("[email] resend rejected the batch:", error.message);
        return sent > 0 ? { ok: true, sent } : { ok: false, reason: "SEND_FAILED" };
      }
      sent += batch.length;
    } catch (cause) {
      console.error("[email] could not reach resend:", cause);
      return sent > 0 ? { ok: true, sent } : { ok: false, reason: "SEND_FAILED" };
    }
  }
  return { ok: true, sent };
}

/** Convenience wrapper for the single-recipient case. */
export function sendEmail(message: EmailMessage): Promise<EmailResult> {
  return sendEmails([message]);
}
