import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { requireUser } from "@/lib/auth/session";
import { SectionTitle } from "@/components/ui";

/**
 * Read live from the database on every request. Without this Next prerenders
 * the page at build time, which would freeze the hub and provider data into
 * the build output.
 */
export const dynamic = "force-dynamic";

/**
 * Provider picker. A production build would resolve the signed-in provider;
 * this build lists them so the dashboard and calendar can be demonstrated.
 */
export default async function ProviderIndexPage() {
  // This listed every provider so you could click in as any of them. With
  // real accounts a provider goes straight to their own dashboard; only an
  // admin sees the roster.
  const viewer = await requireUser("/provider");
  if (viewer.role === "PROVIDER") {
    redirect(
      viewer.providerApproved ? `/provider/${viewer.providerId}` : "/provider/pending",
    );
  }
  if (viewer.role !== "ADMIN") redirect("/forbidden");

  const providers = await prisma.provider.findMany({
    orderBy: [{ rating: "desc" }, { name: "asc" }],
    include: {
      hub: { select: { name: true, sector: true } },
      _count: { select: { bookings: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">
          Provider dashboards
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Open a provider to see their calendar, reserved periods and open
          booking requests.
        </p>
      </div>

      <section>
        <SectionTitle hint={`${providers.length} providers`}>
          Choose a provider
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {providers.map((provider) => (
            <Link
              key={provider.id}
              href={`/provider/${provider.id}`}
              className="rounded-glam border border-line bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-raised"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold text-ink">
                    {provider.name}
                  </p>
                  <p className="text-sm text-ink-muted">{provider.hub.name}</p>
                </div>
                <span className="rounded-full bg-accent-100 px-2.5 py-1 text-xs font-semibold text-accent-700">
                  {provider.rating.toFixed(1)}★
                </span>
              </div>
              <p className="mt-3 text-xs text-ink-muted">
                {provider.hub.sector} · {provider.completedBookings} completed ·{" "}
                {provider._count.bookings} on file
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
