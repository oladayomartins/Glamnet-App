import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Prohibit } from "@phosphor-icons/react/dist/ssr";
import { isSessionSuspended } from "@/lib/auth/session";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Account suspended", robots: { index: false } };

/** Where a suspended account lands instead of any signed-in page. */
export default async function SuspendedPage() {
  if (!(await isSessionSuspended())) redirect("/");

  return (
    <div className="mx-auto max-w-lg py-10">
      <Card className="border-l-4 border-l-warning p-6">
        <Prohibit size={28} className="text-warning" aria-hidden />
        <h1 className="mt-3 font-display text-2xl font-bold text-ink">Your account is suspended</h1>
        <p className="mt-2 text-sm text-ink-muted">
          An administrator has paused this account, so bookings and your dashboard are unavailable
          for now. If you think this is a mistake, reply to any GLAMNET email and we&rsquo;ll look
          into it.
        </p>
        <form action="/auth/sign-out" method="post" className="mt-5">
          <button
            type="submit"
            className="min-h-11 rounded-full bg-metal px-6 text-sm font-bold text-metal-ink transition duration-[180ms] ease-glam hover:brightness-105"
          >
            Sign out
          </button>
        </form>
      </Card>
    </div>
  );
}
