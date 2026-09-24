import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/server/prisma";
import { signedFileUrl } from "@/lib/server/private-files";
import { AdminHeader, fieldClass } from "../_components/bits";
import { ApprovalQueue, type QueueProvider } from "./approval-queue";

export const dynamic = "force-dynamic";

export const metadata = { title: "Vendors" };

const TABS = [
  { key: "PENDING", label: "Awaiting review" },
  { key: "APPROVED", label: "Live" },
  { key: "SUSPENDED", label: "Suspended" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ALL", label: "All" },
] as const;
type Tab = (typeof TABS)[number]["key"];

/** Vendor management: vet applications, suspend, reinstate and feature. */
export default async function AdminProvidersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireRole("ADMIN", "/admin/providers");
  const params = await searchParams;
  const tab: Tab = TABS.some((entry) => entry.key === params.status) ? (params.status as Tab) : "PENDING";
  const q = params.q?.trim() ?? "";

  const where: Prisma.ProviderWhereInput = {
    ...(tab === "ALL" ? {} : { approvalStatus: tab }),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [providers, counts] = await Promise.all([
    prisma.provider.findMany({
      where,
      // Finished applications first: an unfinished wizard is not yet asking
      // for a decision.
      orderBy: [{ onboardedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      take: 200,
      include: {
        hub: { select: { name: true, sector: true, city: true } },
        _count: { select: { services: true, bookings: true } },
        documents: { orderBy: { uploadedAt: "desc" } },
      },
    }),
    prisma.provider.groupBy({ by: ["approvalStatus"], _count: true }),
  ]);
  const countFor = (key: Tab) =>
    key === "ALL"
      ? counts.reduce((sum, row) => sum + row._count, 0)
      : (counts.find((row) => row.approvalStatus === key)?._count ?? 0);

  // Compliance documents are private files; each link is signed for ten
  // minutes, enough to review, useless if it leaks.
  const queue: QueueProvider[] = providers.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    bio: p.bio,
    avatarUrl: p.avatarUrl,
    hub: `${p.hub.name} (${p.hub.sector}) · ${p.hub.city}`,
    status: p.approvalStatus,
    note: p.approvalNote,
    serviceCount: p._count.services,
    bookingCount: p._count.bookings,
    createdAt: p.createdAt.toISOString(),
    slug: p.slug ?? "",
    submitted: p.onboardedAt !== null,
    payoutsEnabled: p.payoutsEnabled,
    isFeatured: p.isFeatured,
    documents: p.documents.map((document) => ({
      id: document.id,
      kind: document.kind,
      fileName: document.fileName,
      status: document.status,
      url: signedFileUrl(document.url),
    })),
  }));

  const href = (status: Tab) => `/admin/providers?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <div>
      <AdminHeader
        title="Vendors"
        lede="Approve applications once their documents check out, suspend a vendor who breaks the rules, and feature the best at the top of the directory."
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Vendor status" className="flex flex-wrap gap-1.5">
          {TABS.map(({ key, label }) => (
            <Link
              key={key}
              href={href(key)}
              aria-current={tab === key ? "page" : undefined}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition duration-[180ms] ease-glam ${
                tab === key ? "bg-metal text-metal-ink" : "bg-surface text-ink-muted ring-1 ring-line hover:text-ink"
              }`}
            >
              {label}
              <span className="font-mono text-[11px] opacity-70">{countFor(key)}</span>
            </Link>
          ))}
        </nav>
        <form className="w-full sm:w-64">
          <input type="hidden" name="status" value={tab} />
          <input name="q" defaultValue={q} placeholder="Search name, email or link" className={`${fieldClass} mt-0`} />
        </form>
      </div>

      <ApprovalQueue
        providers={queue}
        emptyMessage={q ? `No vendors match “${q}”.` : tab === "PENDING" ? "No applications waiting. New sign-ups appear here." : "Nobody here yet."}
      />
    </div>
  );
}
