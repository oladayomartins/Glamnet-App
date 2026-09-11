import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/server/prisma";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Shown to a provider whose application has not been approved yet. */
export default async function ProviderPendingPage() {
  const user = await requireRole("PROVIDER", "/provider/pending");

  // Already approved: no reason to sit on a waiting screen.
  if (user.providerApproved) {
    return (
      <Card className="p-6">
        <h1 className="font-display text-2xl font-bold text-ink">
          You are approved
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Your account is live and you can receive booking requests.
        </p>
        <Link
          href={`/provider/${user.providerId}`}
          className="mt-5 inline-flex rounded-glam-sm bg-brand-700 px-4 py-2.5 text-sm font-semibold text-on-brand"
        >
          Open your dashboard
        </Link>
      </Card>
    );
  }

  const provider = user.providerId
    ? await prisma.provider.findUnique({
        where: { id: user.providerId },
        include: { hub: { select: { name: true, sector: true } } },
      })
    : null;

  const rejected = provider?.approvalStatus === "REJECTED";

  return (
    <div className="mx-auto max-w-lg py-8">
      <Card className={`p-6 ${rejected ? "border-l-4 border-l-warning" : ""}`}>
        <h1 className="font-display text-2xl font-bold text-ink">
          {rejected ? "Application not approved" : "Application under review"}
        </h1>

        {rejected ? (
          <p className="mt-2 text-sm text-ink">
            {provider?.approvalNote ||
              "Your application was not approved. Contact support if you think this is a mistake."}
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">
            Thanks for applying to GLAMNET. Every professional is reviewed
            before going live, because we are sending them into customers&rsquo;
            homes. You will be notified as soon as a decision is made.
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
