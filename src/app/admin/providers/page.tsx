import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/server/prisma";
import { SectionTitle } from "@/components/ui";
import { ApprovalQueue } from "./approval-queue";

export const dynamic = "force-dynamic";

/** Admin vetting queue: who is waiting, and who is already live. */
export default async function AdminProvidersPage() {
  await requireRole("ADMIN", "/admin/providers");

  const providers = await prisma.provider.findMany({
    orderBy: [{ approvalStatus: "asc" }, { createdAt: "desc" }],
    include: {
      hub: { select: { name: true, sector: true, city: true } },
      _count: { select: { services: true, bookings: true } },
    },
  });

  const pending = providers.filter((p) => p.approvalStatus === "PENDING");
  const decided = providers.filter((p) => p.approvalStatus !== "PENDING");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Providers</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Applications are reviewed before a professional can receive work.
        </p>
      </div>

      <section>
        <SectionTitle hint={`${pending.length} waiting`}>
          Awaiting review
        </SectionTitle>
        <ApprovalQueue
          providers={pending.map((p) => ({
            id: p.id,
            name: p.name,
            email: p.email,
            bio: p.bio,
            hub: `${p.hub.name} (${p.hub.sector}) · ${p.hub.city}`,
            status: p.approvalStatus,
            note: p.approvalNote,
            serviceCount: p._count.services,
            bookingCount: p._count.bookings,
            createdAt: p.createdAt.toISOString(),
          }))}
          emptyMessage="No applications waiting. New sign-ups appear here."
        />
      </section>

      <section>
        <SectionTitle hint={`${decided.length} decided`}>
          Approved &amp; rejected
        </SectionTitle>
        <ApprovalQueue
          providers={decided.map((p) => ({
            id: p.id,
            name: p.name,
            email: p.email,
            bio: p.bio,
            hub: `${p.hub.name} (${p.hub.sector}) · ${p.hub.city}`,
            status: p.approvalStatus,
            note: p.approvalNote,
            serviceCount: p._count.services,
            bookingCount: p._count.bookings,
            createdAt: p.createdAt.toISOString(),
          }))}
          emptyMessage="Nothing decided yet."
        />
      </section>
    </div>
  );
}
