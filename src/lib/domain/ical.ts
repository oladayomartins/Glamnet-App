/**
 * An iCalendar (RFC 5545) feed for a vendor's diary, which Google, Apple and
 * Outlook calendars subscribe to. Pure, so it can be tested without a
 * database.
 *
 * Times are written in UTC ("…Z"), which every calendar converts to the
 * phone's own zone, so British Summer Time needs no special handling here.
 */

export interface FeedEvent {
  /** Stable across refreshes, so a moved booking moves rather than duplicates. */
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  /** Bumped when the booking changes, so calendars take the new version. */
  sequence?: number;
  /** "CONFIRMED" by default; "TENTATIVE" for a booking not yet secured. */
  status?: "CONFIRMED" | "TENTATIVE";
}

/** Escape a TEXT value: backslash, semicolon, comma and newlines. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** 20261007T090000Z */
export function icsDate(at: Date): string {
  return at.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Fold a content line at 75 octets, continuing with CRLF + space (RFC 5545
 * §3.1). Counted in UTF-8 bytes, never splitting a character.
 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    // Continuation lines start with a space, which counts towards the 75.
    const limit = parts.length === 0 ? 75 : 74;
    if (size + bytes > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildCalendar(input: { name: string; events: readonly FeedEvent[]; now?: Date }): string {
  const stamp = icsDate(input.now ?? new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GLAMNET//Vendor diary//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(input.name)}`,
    "X-WR-TIMEZONE:Europe/London",
    // How often subscribers should look again. Google sets its own pace
    // (often several hours); Apple and Outlook honour this.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const event of input.events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(event.start)}`,
      `DTEND:${icsDate(event.end)}`,
      `SEQUENCE:${event.sequence ?? 0}`,
      `SUMMARY:${escapeText(event.summary)}`,
      `STATUS:${event.status ?? "CONFIRMED"}`,
      "TRANSP:OPAQUE",
    );
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    if (event.url) lines.push(`URL:${event.url}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
