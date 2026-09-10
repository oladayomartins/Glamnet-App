import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { ProviderDashboard } from "./dashboard";

/** Provider PWA dashboard: calendar plus the broadcast inbox (spec §2, §6). */
export default async function ProviderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const provider = await prisma.provider.findUnique({
    where: { id },
    include: { hub: { select: { name: true, sector: true } } },
  });

  if (!provider) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/provider"
          className="tap-44 text-sm text-ink-muted hover:text-brand-700"
        >
          ← All providers
        </Link>
        <h1 className="mt-1 font-display text-2xl font-bold text-ink">
          {provider.name}
        </h1>
        <p className="text-sm text-ink-muted">
          {provider.hub.name} · {provider.hub.sector} ·{" "}
          {provider.rating.toFixed(1)}★ · {provider.completedBookings} completed
        </p>
      </div>

      <ProviderDashboard providerId={provider.id} />
    </div>
  );
}
