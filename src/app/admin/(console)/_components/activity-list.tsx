import Link from "next/link";
import type { AdminAuditLog } from "@prisma/client";
import { Card, EmptyState } from "@/components/ui";

const TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});

/** "vendor.approve" → "Vendor approve". */
function describe(action: string): string {
  const text = action.replace(/[._]/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Where an entry's target lives in the console, if anywhere. */
export function targetHref(entry: Pick<AdminAuditLog, "targetType" | "targetId">): string | null {
  const id = entry.targetId;
  switch (entry.targetType) {
    case "Provider":
    case "AppUser":
    case "Customer":
      return id ? `/admin/accounts/${id}` : null;
    case "Booking":
      return id ? `/admin/bookings/${id}` : "/admin/bookings";
    case "AdPlacement":
      return "/admin/ads";
    case "Campaign":
      return "/admin/campaigns";
    case "PromoCode":
      return "/admin/promos";
    case "Category":
    case "Service":
      return "/admin/catalogue";
    case "City":
      return "/admin/cities";
    case "EmergencyPricingConfig":
      return "/admin/settings";
    default:
      return null;
  }
}

export function ActivityList({ entries, empty }: { entries: AdminAuditLog[]; empty?: string }) {
  if (entries.length === 0) {
    return <EmptyState>{empty ?? "No admin actions yet. Approvals, suspensions and edits are recorded here."}</EmptyState>;
  }
  return (
    <Card className="divide-y divide-line">
      {entries.map((entry) => {
        const href = targetHref(entry);
        return (
          <div key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-3 text-sm">
            {href ? (
              <Link href={href} className="font-semibold text-ink hover:text-accent-700">
                {describe(entry.action)}
              </Link>
            ) : (
              <span className="font-semibold text-ink">{describe(entry.action)}</span>
            )}
            {/* Wraps rather than truncating: the summary is often the reason. */}
            <span className="order-last w-full break-words text-ink-muted sm:order-none sm:w-auto sm:min-w-0 sm:flex-1">{entry.summary}</span>
            <span className="font-mono text-[11px] text-ink-muted">
              {entry.actorEmail} · {TIME.format(entry.createdAt)}
            </span>
          </div>
        );
      })}
    </Card>
  );
}
