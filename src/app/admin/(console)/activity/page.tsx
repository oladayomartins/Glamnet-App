import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/server/prisma";
import { AdminHeader } from "../_components/bits";
import { ActivityList } from "../_components/activity-list";

export const dynamic = "force-dynamic";

export const metadata = { title: "Activity log" };

/** Every admin action, newest first. Read-only: the log cannot be edited. */
export default async function AdminActivityPage() {
  await requireRole("ADMIN", "/admin/activity");
  const entries = await prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
  return (
    <div>
      <AdminHeader
        title="Activity log"
        lede="Who approved, suspended, edited or sent what, and when. The last 300 actions."
      />
      <ActivityList entries={entries} />
    </div>
  );
}
