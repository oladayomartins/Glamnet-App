import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BellRinging, Lightning, WifiSlash } from "@phosphor-icons/react/dist/ssr";
import { getSessionUser } from "@/lib/auth/session";
import { headers } from "next/headers";
import { siteUrl } from "@/lib/site";
import { PushPrompt } from "@/components/push-prompt";
import { Card } from "@/components/ui";
import { InstallGuide } from "./install-guide";

export const metadata: Metadata = {
  title: "Get the app",
  description:
    "Add GLAMNET to your phone's home screen in a few taps — no app store needed — and turn on notifications for booking updates.",
  alternates: { canonical: "/install" },
};

const PERKS = [
  { icon: <Lightning size={20} weight="fill" />, title: "One tap to open", body: "GLAMNET sits on your home screen and opens full screen, like any app." },
  { icon: <BellRinging size={20} weight="fill" />, title: "Booking updates", body: "Hear the moment a pro accepts, your PIN is ready or a request comes in." },
  { icon: <WifiSlash size={20} weight="fill" />, title: "Honest offline", body: "No signal? It says so plainly, rather than a blank page." },
];

const TROUBLE = [
  {
    q: "I'm not getting notifications",
    a: (
      <>
        Make sure you turned them on in GLAMNET (below, or on your account page — vendors under <strong>Settings</strong>).
        Then check your phone allows them: on iPhone, <strong>Settings → Notifications → GLAMNET</strong>; on Android,{" "}
        <strong>Settings → Apps → GLAMNET</strong> (or Chrome) <strong>→ Notifications</strong>. Focus, Do Not Disturb and
        battery saver can hold them back too. On iPhone, open GLAMNET from its home-screen icon, not from Safari.
      </>
    ),
  },
  {
    q: "I blocked notifications by mistake",
    a: (
      <>
        On a phone, allow them in the settings above. In a browser, click the icon to the left of the web address, find{" "}
        <strong>Notifications</strong>, set it to <strong>Allow</strong>, then reload GLAMNET and turn them on again.
      </>
    ),
  },
  {
    q: "I don't see “Add to Home Screen” or “Install”",
    a: (
      <>
        On iPhone it&rsquo;s only in Safari&rsquo;s (or Chrome&rsquo;s) <strong>Share</strong> menu — scroll down the list. On
        Android, use Chrome or Samsung Internet; some in-app browsers (Instagram, Facebook) can&rsquo;t install, so open the
        link in your browser first. If GLAMNET is already installed, the option is hidden.
      </>
    ),
  },
  {
    q: "Notifications go to the wrong account",
    a: <>Sign out and back in on that device, then turn notifications on again: they follow whoever last turned them on there.</>,
  },
  {
    q: "How do I remove the app?",
    a: (
      <>
        Press and hold the GLAMNET icon and choose <strong>Remove App</strong> (iPhone) or <strong>Uninstall</strong>{" "}
        (Android). On a computer, open GLAMNET, then its menu, and choose <strong>Uninstall</strong>. Your account and
        bookings stay as they are.
      </>
    ),
  },
];

/**
 * How to put GLAMNET on a home screen and switch on notifications, for
 * customers and vendors, on every common phone and computer.
 */
export default async function InstallPage() {
  const user = await getSessionUser();
  // The address the reader actually came in on, so a preview or a second
  // domain names itself; the configured site address otherwise.
  const host = (await headers()).get("host") ?? new URL(siteUrl()).host;

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="flex flex-wrap items-center gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element -- the app's own icon */}
        <img src="/icon-192.png" alt="" width={72} height={72} className="h-[72px] w-[72px] rounded-[18px] shadow-card" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em] text-ink">Get the GLAMNET app</h1>
          <p className="mt-1 text-[15px] text-ink-muted">
            Install GLAMNET straight from your browser in under a minute. There&rsquo;s no app store, it&rsquo;s free, and it
            takes up almost no space.
          </p>
        </div>
      </header>

      <ul className="grid gap-3 sm:grid-cols-3">
        {PERKS.map((perk) => (
          <li key={perk.title} className="rounded-glam border border-line bg-surface p-4">
            <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-100 text-accent-700">
              {perk.icon}
            </span>
            <p className="mt-3 font-semibold text-ink">{perk.title}</p>
            <p className="mt-0.5 text-sm text-ink-muted">{perk.body}</p>
          </li>
        ))}
      </ul>

      <section aria-labelledby="install-heading">
        <h2 id="install-heading" className="mb-3 font-display text-xl font-bold text-ink">
          1. Add it to your home screen
        </h2>
        <InstallGuide host={host} />
      </section>

      <section aria-labelledby="notify-heading" className="space-y-3">
        <h2 id="notify-heading" className="font-display text-xl font-bold text-ink">
          2. Turn on notifications
        </h2>
        <p className="text-[15px] text-ink-muted">
          Open GLAMNET from its new icon, sign in, and allow notifications when asked.{" "}
          <strong className="text-ink">Vendors:</strong> this is how emergency requests reach you first, even with the app
          closed. <strong className="text-ink">Customers:</strong> you&rsquo;ll hear when a pro accepts and when your PIN is
          ready.
        </p>
        {user ? (
          <PushPrompt audience={user.role} />
        ) : (
          <Card className="flex flex-wrap items-center gap-3 p-4">
            <Bell size={20} className="text-accent-700" aria-hidden />
            <p className="min-w-0 flex-1 text-sm text-ink-muted">Notifications are tied to your account, so sign in first.</p>
            <Link
              href="/sign-in?next=/install"
              className="inline-flex min-h-11 items-center rounded-full bg-metal px-5 text-sm font-bold text-metal-ink"
            >
              Sign in
            </Link>
          </Card>
        )}
        <p className="text-sm text-ink-muted">
          You&rsquo;ll get a &ldquo;Notifications are on&rdquo; message straight away, so you know it&rsquo;s working. You can
          send yourself another test any time from the same switch.
        </p>
      </section>

      <section aria-labelledby="help-heading">
        <h2 id="help-heading" className="mb-3 font-display text-xl font-bold text-ink">
          If something isn&rsquo;t working
        </h2>
        <div className="space-y-2">
          {TROUBLE.map((item) => (
            <details key={item.q} className="group rounded-glam border border-line bg-surface p-4">
              <summary className="cursor-pointer list-none font-semibold text-ink marker:hidden">
                <span className="mr-2 inline-block text-accent-700 transition group-open:rotate-90" aria-hidden>
                  ›
                </span>
                {item.q}
              </summary>
              <p className="mt-2 text-sm text-ink-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
