import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/server/prisma";
import { SectionTitle } from "@/components/ui";
import { ApprovalQueue, type QueueProvider } from "./approval-queue";
import { signedFileUrl } from "@/lib/server/private-files";

export const dynamic = "force-dynamic";

/** Admin vetting queue: who is waiting, and who is already live. */
export default async function AdminProvidersPage() {
  await requireRole("ADMIN", "/admin/providers");

  const providers = await prisma.provider.findMany({
    orderBy: [{ approvalStatus: "asc" }, { createdAt: "desc" }],
    include: {
      hub: { select: { name: true, sector: true, city: true } },
      _count: { select: { services: true, bookings: true } },
      documents: { orderBy: { uploadedAt: "desc" } },
    },
  });

  // Compliance documents are private files; each link is signed for ten
  // minutes, enough to review, useless if it leaks.
  const toQueue = (p: (typeof providers)[number]): QueueProvider => ({
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
    slug: p.slug ?? "",
    submitted: p.onboardedAt !== null,
    payoutsEnabled: p.payoutsEnabled,
    documents: p.documents.map((document) => ({
      id: document.id,
      kind: document.kind,
      fileName: document.fileName,
      status: document.status,
      url: signedFileUrl(document.url),
    })),
  });

  const pending = providers.filter((p) => p.approvalStatus === "PENDING");
  const decided = providers.filter((p) => p.approvalStatus !== "PENDING");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Vendors</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Applications are reviewed before a vendor can receive work.
        </p>
      </div>

      <section>
        <SectionTitle hint={`${pending.length} waiting`}>
          Awaiting review
        </SectionTitle>
        <ApprovalQueue
          providers={pending.map(toQueue)}
          emptyMessage="No applications waiting. New sign-ups appear here."
        />
      </section>

      <section>
        <SectionTitle hint={`${decided.length} decided`}>
          Approved &amp; rejected
        </SectionTitle>
        <ApprovalQueue
          providers={decided.map(toQueue)}
          emptyMessage="Nothing decided yet."
        />
      </section>
    </div>
  );
}
