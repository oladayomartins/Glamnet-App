import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { requireVendorPage } from "../access";
import { gaMeasurementId } from "@/lib/site";
import { Card, SectionTitle } from "@/components/ui";
import { PushPrompt } from "@/components/push-prompt";
import { MarketingEmails } from "@/components/marketing-emails";
import { CookieSettingsButton } from "@/components/analytics";

export const dynamic = "force-dynamic";

const ROW =
  "flex min-h-14 items-center justify-between gap-3 px-4 py-3 transition duration-[180ms] hover:bg-sunken";

/**
 * The vendor's settings — the Profile tab. Notification and email switches
 * live here rather than on the dashboard, where they took prime space and
 * their small "Turn off" links were easy to hit by mistake.
 */
export default async function VendorSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const viewer = await requireVendorPage(id, `/provider/${id}/settings`);

  const provider = await prisma.provider.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true },
  });
  if (!provider) notFound();

  const isOwner = viewer.providerId === id;
  const account = isOwner
    ? await prisma.appUser.findUnique({
        where: { id: viewer.appUserId },
        select: { marketingOptOutAt: true },
      })
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-[28px] font-bold leading-tight text-ink">
          Profile &amp; settings
        </h1>
        <p className="mt-1 text-sm text-ink-muted">{provider.name}</p>
      </div>

      <section>
        <SectionTitle>Your business</SectionTitle>
        <Card className="divide-y divide-line overflow-hidden p-0">
          <Link href="/provider/onboarding" className={ROW}>
            <span>
              <span className="block font-semibold text-ink">Storefront</span>
              <span className="block text-sm text-ink-muted">
                Photos, bio, services and prices
              </span>
            </span>
            <span aria-hidden className="text-ink-muted">→</span>
          </Link>
          <Link href={`/provider/${provider.id}/availability`} className={ROW}>
            <span>
              <span className="block font-semibold text-ink">Working hours</span>
              <span className="block text-sm text-ink-muted">
                When requests can reach you, and time off
              </span>
            </span>
            <span aria-hidden className="text-ink-muted">→</span>
          </Link>
          {provider.slug ? (
            <Link href={`/pro/${provider.slug}`} className={ROW}>
              <span className="font-semibold text-ink">View my storefront</span>
              <span aria-hidden className="text-ink-muted">→</span>
            </Link>
          ) : null}
        </Card>
      </section>

      {isOwner ? (
        <section className="space-y-3">
          <SectionTitle>Notifications and emails</SectionTitle>
          <Card className="space-y-1 p-4">
            <PushPrompt audience="PROVIDER" />
            <MarketingEmails initiallySubscribed={!account?.marketingOptOutAt} />
            <p className="text-xs text-ink-muted">
              Booking and account emails always reach you — they&rsquo;re part of the
              service, not marketing.
            </p>
          </Card>
        </section>
      ) : null}

      <section>
        <SectionTitle>Account</SectionTitle>
        <Card className="divide-y divide-line overflow-hidden p-0">
          {gaMeasurementId() !== null ? (
            <CookieSettingsButton className={`${ROW} w-full text-left font-semibold text-ink`} />
          ) : null}
          {isOwner ? (
            <form action="/auth/sign-out" method="post">
              <button type="submit" className={`${ROW} w-full text-left font-semibold text-warning`}>
                Sign out
              </button>
            </form>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
