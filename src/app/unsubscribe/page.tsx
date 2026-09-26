import Link from "next/link";
import { Card } from "@/components/ui";
import { subscriptionForToken } from "@/lib/server/unsubscribe";
import { UnsubscribeButton } from "./unsubscribe-button";

export const metadata = { title: "Unsubscribe", robots: { index: false } };

/**
 * Where a campaign email's "Unsubscribe" link lands. One tap to confirm, no
 * sign-in. The page itself changes nothing: email scanners open links, and a
 * scanner mustn't unsubscribe anyone.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t = "" } = await searchParams;
  const subscription = await subscriptionForToken(t);

  return (
    <div className="mx-auto max-w-md py-10">
      <Card className="p-6">
        {subscription ? (
          <UnsubscribeButton token={t} email={subscription.email} initiallyOptedOut={subscription.optedOut} />
        ) : (
          <>
            <h1 className="font-display text-xl font-bold text-ink">This link doesn&rsquo;t work</h1>
            <p className="mt-2 text-sm text-ink-muted">
              It may have been copied incompletely. You can turn news and offers off from your{" "}
              <Link href="/account" className="font-semibold text-accent-700 hover:underline">
                account page
              </Link>{" "}
              instead.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
