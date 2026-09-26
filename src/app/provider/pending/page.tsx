import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/server/prisma";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Shown to a vendor whose application has not been approved yet. */
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

  const suspended = provider?.approvalStatus === "SUSPENDED";
  const rejected = provider?.approvalStatus === "REJECTED" || suspended;

  // Under review: a warm, clear "what happens next", not a dead end.
  if (!rejected && provider) {
    const firstName = provider.name.trim().split(/\s+/)[0] || "there";
    const submitted = provider.onboardedAt !== null;
    const stages = [
      { title: "Storefront built", body: "Your menu, photos and link are saved.", state: submitted ? "done" : "now" },
      { title: "Documents checked", body: "We check your insurance or licence — usually within 1–2 working days.", state: submitted ? "now" : "next" },
      { title: "You're live", body: "Clients near you can find and book you, and we email you straight away.", state: "next" },
    ] as const;
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-4">
        <section className="rise-in overflow-hidden rounded-glam-lg border border-accent-500/40 bg-[radial-gradient(90%_120%_at_0%_0%,color-mix(in_oklab,var(--glam-gold)_22%,transparent),transparent_70%)] bg-surface p-6 sm:p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-700">
            {submitted ? "Application received" : "Almost there"}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight tracking-[-0.02em] text-ink">
            {submitted ? `Thank you, ${firstName}! You're in the queue.` : `Nearly done, ${firstName}.`}
          </h1>
          <p className="mt-2 text-[15px] text-ink-muted">
            {submitted
              ? "Every pro on GLAMNET is checked before going live, so clients can book with confidence. We'll email you as soon as you're approved."
              : "Finish setting up your storefront and submit it, and we'll check your documents."}
          </p>
          <Link
            href="/provider/onboarding"
            className="mt-5 inline-flex min-h-11 items-center rounded-full bg-metal px-6 text-sm font-bold text-metal-ink transition hover:brightness-105"
          >
            {submitted ? "Edit my storefront" : "Finish my storefront"}
          </Link>
        </section>

        <ol className="space-y-3">
          {stages.map((stage, at) => (
            <li
              key={stage.title}
              style={{ animationDelay: `${at * 90}ms` }}
              className={`rise-in flex gap-4 rounded-glam border p-4 ${
                stage.state === "now" ? "border-accent-500 bg-accent-100/20" : "border-line bg-surface"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold ${
                  stage.state === "done"
                    ? "bg-normal text-on-obsidian"
                    : stage.state === "now"
                      ? "bg-metal text-metal-ink"
                      : "bg-sunken text-ink-muted"
                }`}
                aria-hidden
              >
                {stage.state === "done" ? "✓" : at + 1}
              </span>
              <div>
                <p className="font-display font-semibold text-ink">
                  {stage.title}
                  {stage.state === "now" ? <span className="ml-2 text-xs font-medium text-accent-700">In progress</span> : null}
                </p>
                <p className="mt-0.5 text-sm text-ink-muted">{stage.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <Card className="p-5">
          <p className="font-display font-semibold text-ink">While you wait</p>
          <ul className="mt-2 space-y-1.5 text-sm text-ink-muted">
            <li>• Add your best three looks — storefronts with photos get far more bookings.</li>
            <li>• Link your bank so the first payment reaches you without delay.</li>
            {provider.slug ? (
              <li>
                • Your link will be <span className="font-mono text-ink">glamnetapp.com/pro/{provider.slug}</span> — get ready to
                share it in your bio.
              </li>
            ) : null}
          </ul>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg py-8">
      <Card className={`p-6 ${rejected ? "border-l-4 border-l-warning" : ""}`}>
        <h1 className="font-display text-2xl font-bold text-ink">
          {suspended
            ? "Your storefront is paused"
            : rejected
              ? "Application not approved"
              : "Application under review"}
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
            Thanks for applying to GLAMNET. Every vendor is reviewed
            before going live, because we are sending them into customers&rsquo;
            homes. You will be notified as soon as a decision is made.
          </p>
        )}

        {!rejected ? (
          <Link
            href="/provider/onboarding"
            className="mt-4 inline-flex min-h-11 items-center rounded-full bg-metal px-5 text-sm font-bold text-metal-ink"
          >
            {provider?.onboardedAt ? "Edit your storefront" : "Finish setting up your storefront"}
          </Link>
        ) : null}

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
