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

export function ActivityList({ entries }: { entries: AdminAuditLog[] }) {
  if (entries.length === 0) {
    return <EmptyState>No admin actions yet. Approvals, suspensions and edits are recorded here.</EmptyState>;
  }
  return (
    <Card className="divide-y divide-line">
      {entries.map((entry) => (
        <div key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-3 text-sm">
          <span className="font-semibold text-ink">{describe(entry.action)}</span>
          <span className="min-w-0 flex-1 truncate text-ink-muted">{entry.summary}</span>
          <span className="font-mono text-[11px] text-ink-muted">
            {entry.actorEmail} · {TIME.format(entry.createdAt)}
          </span>
        </div>
      ))}
    </Card>
  );
}
