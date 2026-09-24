/**
 * Transactional email bodies.
 *
 * Pure functions: no Resend import, no environment access, no I/O. That keeps
 * them unit-testable and keeps the delivery concern (src/lib/server/email.ts)
 * separate from what the message says.
 *
 * Two rules from the brand guide are load-bearing here and cannot be expressed
 * with the app's CSS tokens, because email clients do not support `oklch()`,
 * custom properties, or external stylesheets:
 *
 *  - every colour is an inline sRGB hex, converted from the same `--glam-*`
 *    tokens in globals.css, so an email and the app agree on the brand;
 *  - red (#D0342C, from --glam-emergency) is reserved for the EMERGENCY tag.
 *    It never appears on a normal booking, which is the whole point of the
 *    tag: spec §11 requires the classification to read identically in every
 *    channel, so a customer or vendor can tell the two apart at a glance.
 */

const INK = "#2A2A31";
const INK_MUTED = "#6B6B75";
const CANVAS = "#FAFAF7";
const SURFACE = "#FFFFFF";
const BORDER = "#E3E1DD";
const ROSE = "#A45950"; // --glam-rose-600
const ROSE_DEEP = "#723B31"; // --glam-rose-700
const CHAMPAGNE = "#E3CFA1"; // --glam-champagne-500
const METAL_INK = "#180F0D";
const EMERGENCY = "#D0342C"; // --glam-emergency
const ON_BRAND = "#FDFCF8";

export interface EmailBody {
  subject: string;
  html: string;
  text: string;
}

/** Minimal HTML escape — every interpolated value below is user-supplied. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The shared shell: obsidian masthead, white card, muted footer.
 *
 * Table-based on purpose. Outlook renders `<div>` layouts unpredictably and
 * these messages carry booking money, so structure beats elegance.
 */
function shell(options: {
  preheader: string;
  tag?: { label: string; color: string };
  heading: string;
  body: string;
  cta?: { label: string; url: string };
  footerNote?: string;
}): string {
  const { preheader, tag, heading, body, cta, footerNote } = options;
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${CANVAS};color:${INK};font-family:Helvetica,Arial,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${SURFACE};border:1px solid ${BORDER};border-radius:18px;overflow:hidden;">
  <tr><td style="background:${METAL_INK};padding:20px 28px;">
    <span style="font-size:17px;font-weight:700;letter-spacing:0.22em;color:${CHAMPAGNE};">GLAMNET</span>
  </td></tr>
  <tr><td style="padding:28px;">
    ${
      tag
        ? `<p style="margin:0 0 14px;"><span style="display:inline-block;padding:5px 13px;border-radius:999px;background:${tag.color};color:${ON_BRAND};font-size:11px;font-weight:700;letter-spacing:0.12em;">${escapeHtml(tag.label)}</span></p>`
        : ""
    }
    <h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;color:${INK};">${escapeHtml(heading)}</h1>
    ${body}
    ${
      cta
        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 4px;"><tr><td style="border-radius:999px;background:${ROSE};"><a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:${ON_BRAND};text-decoration:none;">${escapeHtml(cta.label)}</a></td></tr></table>`
        : ""
    }
  </td></tr>
  <tr><td style="padding:18px 28px;border-top:1px solid ${BORDER};background:${CANVAS};">
    <p style="margin:0;font-size:12px;line-height:1.6;color:${INK_MUTED};">${escapeHtml(footerNote ?? "You are receiving this because of activity on your GLAMNET account.")}</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${INK};">${escapeHtml(text)}</p>`;
}

/** A label/value list — the booking facts, in the order they matter. */
function factList(rows: Array<[string, string]>): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border:1px solid ${BORDER};border-radius:12px;">${rows
    .map(
      ([label, value], index) =>
        `<tr><td style="padding:10px 14px;font-size:13px;color:${INK_MUTED};${index ? `border-top:1px solid ${BORDER};` : ""}">${escapeHtml(label)}</td><td align="right" style="padding:10px 14px;font-size:14px;font-weight:600;color:${INK};${index ? `border-top:1px solid ${BORDER};` : ""}">${escapeHtml(value)}</td></tr>`,
    )
    .join("")}</table>`;
}

function textBlock(lines: Array<string | null>): string {
  return lines.filter((line) => line !== null).join("\n");
}

export interface BookingEmailFacts {
  isEmergency: boolean;
  serviceNames: string[];
  /** Already formatted for display, e.g. "Fri 12 Sep, 14:00". */
  appointmentLabel: string;
  /** Already formatted for display, e.g. "£125.50". */
  amountLabel: string;
  sector: string;
  url: string;
}

/**
 * Vendor broadcast — the message that wins or loses the job.
 *
 * The EMERGENCY variant leads with the deadline because that is the only
 * decision the vendor is making in the ten-minute acceptance window.
 */
export function providerBroadcastEmail(
  providerName: string,
  facts: BookingEmailFacts,
): EmailBody {
  const subject = facts.isEmergency
    ? `EMERGENCY BOOKING REQUEST — ${facts.appointmentLabel}`
    : `New booking request — ${facts.appointmentLabel}`;

  const html = shell({
    preheader: `${facts.serviceNames.join(", ")} in ${facts.sector}, ${facts.appointmentLabel}.`,
    tag: facts.isEmergency
      ? { label: "EMERGENCY", color: EMERGENCY }
      : { label: "NEW REQUEST", color: ROSE_DEEP },
    heading: facts.isEmergency
      ? `Emergency request, ${facts.appointmentLabel}`
      : `New request, ${facts.appointmentLabel}`,
    body:
      paragraph(`Hi ${providerName},`) +
      paragraph(
        facts.isEmergency
          ? "A customer needs this at short notice. First vendor to accept takes the job."
          : "You are one of the vendors this request went out to. First to accept takes the job.",
      ) +
      factList([
        ["Service", facts.serviceNames.join(", ")],
        ["When", facts.appointmentLabel],
        ["Area", facts.sector],
        ["You earn", facts.amountLabel],
      ]),
    cta: { label: "View the request", url: facts.url },
    footerNote:
      "Requests are offered to several vendors at once and close as soon as one accepts.",
  });

  const text = textBlock([
    facts.isEmergency ? "EMERGENCY BOOKING REQUEST" : "New booking request",
    "",
    `Hi ${providerName},`,
    facts.isEmergency
      ? "A customer needs this at short notice. First vendor to accept takes the job."
      : "You are one of the vendors this request went out to. First to accept takes the job.",
    "",
    `Service: ${facts.serviceNames.join(", ")}`,
    `When: ${facts.appointmentLabel}`,
    `Area: ${facts.sector}`,
    `You earn: ${facts.amountLabel}`,
    "",
    facts.url,
  ]);

  return { subject, html, text };
}

/** Customer confirmation — sent the moment a vendor claims the booking. */
export function customerBookingConfirmedEmail(
  customerName: string,
  providerName: string,
  facts: BookingEmailFacts,
): EmailBody {
  const subject = facts.isEmergency
    ? `EMERGENCY BOOKING confirmed — ${facts.appointmentLabel}`
    : `Your booking is confirmed — ${facts.appointmentLabel}`;

  const html = shell({
    preheader: `${providerName} is confirmed for ${facts.appointmentLabel}.`,
    tag: facts.isEmergency
      ? { label: "EMERGENCY", color: EMERGENCY }
      : { label: "CONFIRMED", color: ROSE_DEEP },
    heading: `${providerName} has accepted your booking`,
    body:
      paragraph(`Hi ${customerName},`) +
      paragraph(
        "Your request has been picked up. You will get the exact arrival details closer to the time.",
      ) +
      factList([
        ["Service", facts.serviceNames.join(", ")],
        ["When", facts.appointmentLabel],
        ["Provider", providerName],
        ["Total", facts.amountLabel],
      ]),
    cta: { label: "View your booking", url: facts.url },
  });

  const text = textBlock([
    facts.isEmergency
      ? "EMERGENCY BOOKING confirmed"
      : "Your booking is confirmed",
    "",
    `Hi ${customerName},`,
    `${providerName} has accepted your booking.`,
    "",
    `Service: ${facts.serviceNames.join(", ")}`,
    `When: ${facts.appointmentLabel}`,
    `Total: ${facts.amountLabel}`,
    "",
    facts.url,
  ]);

  return { subject, html, text };
}

/**
 * Vendor vetting decision.
 *
 * A rejection is not an error state, so it gets no red: the brand guide keeps
 * red for EMERGENCY, and dressing a rejection in it would both break that rule
 * and read far harsher than intended.
 */
export function providerApprovalEmail(
  providerName: string,
  decision: "APPROVED" | "REJECTED" | "PENDING",
  note: string,
  url: string,
): EmailBody {
  const copy = {
    APPROVED: {
      subject: "You're approved to take GLAMNET bookings",
      heading: "You're approved",
      lead: "Your application has been reviewed and approved. You will start receiving booking requests for your services and area right away.",
      tag: "APPROVED",
      cta: "Set your availability",
    },
    REJECTED: {
      subject: "An update on your GLAMNET application",
      heading: "We can't approve your application yet",
      lead: "We've reviewed your application and can't approve it at this stage. You are welcome to get in touch if anything has changed.",
      tag: "APPLICATION UPDATE",
      cta: "View your application",
    },
    PENDING: {
      subject: "Your GLAMNET application is under review",
      heading: "Your application is back under review",
      lead: "Your application has been returned to review. We'll be in touch once a decision is made.",
      tag: "UNDER REVIEW",
      cta: "View your application",
    },
  }[decision];

  const html = shell({
    preheader: copy.lead,
    tag: { label: copy.tag, color: ROSE_DEEP },
    heading: copy.heading,
    body:
      paragraph(`Hi ${providerName},`) +
      paragraph(copy.lead) +
      (note ? factList([["Note from the team", note]]) : ""),
    cta: { label: copy.cta, url },
  });

  const text = textBlock([
    copy.heading,
    "",
    `Hi ${providerName},`,
    copy.lead,
    note ? `\nNote from the team: ${note}` : null,
    "",
    url,
  ]);

  return { subject: copy.subject, html, text };
}

/** A marketing campaign email, written by an admin in the console. */
export function campaignEmail(input: {
  title: string;
  message: string;
  cta?: { label: string; url: string };
}): EmailBody {
  const paragraphs = input.message.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const html = shell({
    preheader: paragraphs[0] ?? input.title,
    heading: input.title,
    body: paragraphs.map(paragraph).join(""),
    cta: input.cta,
    footerNote: "You are receiving this because you have a GLAMNET account.",
  });
  const text = textBlock([
    input.title,
    "",
    ...paragraphs.flatMap((block) => [block, ""]),
    input.cta ? `${input.cta.label}: ${input.cta.url}` : null,
  ]);
  return { subject: input.title, html, text };
}
