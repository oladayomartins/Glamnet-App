import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { requireUser } from "@/lib/auth/session";
import { getProviderToday } from "@/lib/server/provider-today";
import { ProviderDashboard } from "./dashboard";
import { TodayStrip } from "./today-strip";
import { VacationToggle } from "./vacation-toggle";
import { BioLink } from "@/components/bio-link";
import { siteUrl } from "@/lib/site";

/** The dashboard reads live figures, so it must not be prerendered. */
export const dynamic = "force-dynamic";

/** Vendor PWA dashboard: calendar plus the broadcast inbox (spec §2, §6). */
export default async function ProviderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // A vendor dashboard shows earnings, customer names and addresses, so it
  // is limited to that vendor and to admins.
  const viewer = await requireUser(`/provider/${id}`);
  if (viewer.role !== "ADMIN" && viewer.providerId !== id) redirect("/forbidden");
  if (viewer.role === "PROVIDER" && !viewer.providerApproved) {
    redirect("/provider/pending");
  }

  const [provider, today] = await Promise.all([
    prisma.provider.findUnique({
      where: { id },
      include: { hub: { select: { name: true, sector: true } } },
    }),
    getProviderToday(id),
  ]);

  if (!provider || !today) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/provider"
          className="tap-44 text-sm text-ink-muted hover:text-brand-700"
        >
          ← All vendors
        </Link>
        <h1 className="mt-1 font-display text-2xl font-bold text-ink">
          {provider.name}
        </h1>
        <p className="text-sm text-ink-muted">
          {provider.hub.name} · {provider.hub.sector} ·{" "}
          {provider.rating.toFixed(1)}★ · {provider.completedBookings} completed
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/provider/${provider.id}/availability`}
            className="inline-flex min-h-11 items-center rounded-full bg-surface px-4 text-sm font-semibold text-ink ring-1 ring-line transition duration-[180ms] hover:bg-sunken"
          >
            Availability
          </Link>
          <Link
            href="/provider/onboarding"
            className="inline-flex min-h-11 items-center rounded-full bg-surface px-4 text-sm font-semibold text-ink ring-1 ring-line transition duration-[180ms] hover:bg-sunken"
          >
            Storefront
          </Link>
          <Link
            href={`/provider/${provider.id}/earnings`}
            className="inline-flex min-h-11 items-center rounded-full bg-surface px-4 text-sm font-semibold text-ink ring-1 ring-line transition duration-[180ms] hover:bg-sunken"
          >
            Earnings ledger
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {provider.slug ? (
          <BioLink origin={siteUrl().replace(/^https?:\/\//, "")} slug={provider.slug} />
        ) : (
          <Link
            href="/provider/onboarding?step=storefront"
            className="rounded-glam border border-dashed border-line p-4 text-sm text-ink-muted hover:border-accent-500"
          >
            Claim your storefront link to share in your Instagram and TikTok bio →
          </Link>
        )}
        <VacationToggle
          accepting={provider.isAcceptingWork}
          disabled={viewer.role !== "PROVIDER"}
        />
      </div>

      <TodayStrip providerId={provider.id} today={today} />

      <ProviderDashboard providerId={provider.id} />
    </div>
  );
}
