import { prisma } from "../prisma";

/**
 * Shared plumbing for the admin console: its error type and the audit log.
 *
 * Every admin mutation goes through a function in this folder and records
 * who did what. The log is append-only from the app's side: nothing in the
 * console edits or deletes it.
 */

export class AdminError extends Error {
  constructor(
    message: string,
    readonly status = 409,
    readonly code = "ADMIN_RULE",
  ) {
    super(message);
    this.name = "AdminError";
  }
}

export async function audit(
  actorEmail: string,
  action: string,
  target: { type: string; id?: string },
  summary = "",
): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorEmail,
        action,
        targetType: target.type,
        targetId: target.id ?? "",
        summary: summary.slice(0, 500),
      },
    });
  } catch (cause) {
    // The action itself has already happened; a lost log line must not turn
    // it into an error the admin would retry.
    console.error("[admin] audit write failed", cause);
  }
}

/** A same-site path or an absolute http(s) URL; anything else is refused. */
export function safeLink(value: string): string {
  const link = value.trim();
  if (!link) return "";
  if (link.startsWith("/") && !link.startsWith("//") && !link.startsWith("/\\")) return link;
  try {
    const url = new URL(link);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {
    // fall through
  }
  throw new AdminError("Links must start with / or https://.", 422, "INVALID_LINK");
}

/** Whether a dated item is live at `now`. */
export function isLive(
  item: { isActive: boolean; startsAt: Date; endsAt: Date | null },
  now = new Date(),
): boolean {
  return item.isActive && item.startsAt <= now && (item.endsAt === null || item.endsAt > now);
}

export type Schedule = "LIVE" | "SCHEDULED" | "ENDED" | "PAUSED";

export function scheduleOf(
  item: { isActive: boolean; startsAt: Date; endsAt: Date | null },
  now = new Date(),
): Schedule {
  if (item.endsAt !== null && item.endsAt <= now) return "ENDED";
  if (!item.isActive) return "PAUSED";
  return item.startsAt > now ? "SCHEDULED" : "LIVE";
}
