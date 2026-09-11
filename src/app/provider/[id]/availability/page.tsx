import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { requireUser } from "@/lib/auth/session";
import { AvailabilityEditor } from "./editor";

export const dynamic = "force-dynamic";

/** Availability and blocked periods (§P-04). */
export default async function AvailabilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const viewer = await requireUser(`/provider/${id}/availability`);
  if (viewer.role !== "ADMIN" && viewer.providerId !== id) redirect("/forbidden");

  const provider = await prisma.provider.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      hub: { select: { city: true, sector: true } },
      availability: {
        orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
      },
      // Past blocks are history, not something to manage: only periods that
      // have not finished yet are editable here.
      timeOff: { where: { endAt: { gt: new Date() } }, orderBy: { startAt: "asc" } },
    },
  });

  if (!provider) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/provider/${provider.id}`}
          className="tap-44 text-sm text-ink-muted hover:text-brand-700"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-[-0.02em] text-ink">
          Availability
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {provider.name} · what we may offer customers on your behalf
        </p>
      </div>

      <AvailabilityEditor
        providerId={provider.id}
        sector={provider.hub.sector}
        city={provider.hub.city}
        windows={provider.availability.map((window) => ({
          dayOfWeek: window.dayOfWeek,
          startMinute: window.startMinute,
          endMinute: window.endMinute,
        }))}
        blocks={provider.timeOff.map((block) => ({
          id: block.id,
          startAt: block.startAt.toISOString(),
          endAt: block.endAt.toISOString(),
          reason: block.reason,
        }))}
      />
    </div>
  );
}
