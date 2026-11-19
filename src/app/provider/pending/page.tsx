import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/server/prisma";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Shown to a vendor whose storefront was rejected or suspended. Everyone else is sent on. */
export default async function ProviderPendingPage() {
  const user = await requireRole("PROVIDER", "/provider/pending");

  // Live (verified or not): the dashboard is theirs, no waiting screen.
  if (user.providerLive) redirect(`/provider/${user.providerId}`);

  const provider = user.providerId
    ? await prisma.provider.findUnique({
        where: { id: user.providerId },
        include: { hub: { select: { name: true, sector: true } } },
      })
    : null;

  const suspended = provider?.approvalStatus === "SUSPENDED";
  const rejected = provider?.approvalStatus === "REJECTED" || suspended;

  // Not live yet: there's no queue to wait in — vendors go live themselves
  // once the basics are done, so send them to finish.
  if (!rejected && provider) redirect("/provider/onboarding?step=review");

  return (
    <div className="mx-auto max-w-lg py-8">
      <Card className={`p-6 ${rejected ? "border-l-4 border-l-warning" : ""}`}>
        <h1 className="font-display text-2xl font-bold text-ink">
          {suspended
            ? "Your storefront is paused"
            : rejected
              ? "Application not approved"
              : "No storefront found"}
        </h1>

        {rejected ? (
          <p className="mt-2 text-sm text-ink">
            {provider?.approvalNote ||
              (suspended
                ? "An administrator has taken your storefront offline. Contact support to have it reinstated."
                : "Your application was not approved. Contact support if you think this is a mistake.")}
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">
            This account has no vendor storefront. Contact support if you think this is a mistake.
          </p>
        )}

        {provider ? (
          <dl className="mt-5 space-y-1 border-t border-line pt-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Name</dt>
              <dd className="text-ink">{provider.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Beauty Hub</dt>
              <dd className="text-ink">
                {provider.hub.name} ({provider.hub.sector})
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Status</dt>
              <dd className="text-ink">{provider.approvalStatus}</dd>
            </div>
          </dl>
        ) : null}

        <Link
          href="/account"
          className="mt-5 inline-flex text-sm font-semibold text-brand-700 hover:underline"
        >
          ← Back to your account
        </Link>
      </Card>
    </div>
  );
}
