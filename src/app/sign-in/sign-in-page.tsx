import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/safe-next";
import { AuthLayout } from "@/components/auth-layout";
import { SignInForm } from "./sign-in-form";

const COPY = {
  everyone: {
    eyebrow: "Welcome back",
    title: "Sign in to GLAMNET",
    lede: "Your bookings, your storefront and your calendar — all behind one sign-in.",
    reassurance: "Your address is only shared with a pro once they are on their way.",
    signUp: { text: "New to GLAMNET?", href: "/sign-up", label: "Create an account" },
  },
  customer: {
    eyebrow: "Welcome back",
    title: "Sign in to book",
    lede: "Pick up a booking, track an appointment, or rate work that is done.",
    reassurance: "Your card is only held until you give your pro the PIN.",
    signUp: { text: "New to GLAMNET?", href: "/sign-up", label: "Create an account" },
  },
  vendor: {
    eyebrow: "For pros",
    title: "Back to work",
    lede: "Sign in to see your bookings, manage your calendar and share your storefront.",
    reassurance: "Vacation mode pauses new bookings. Ones you already have are kept.",
    signUp: {
      text: "Not on GLAMNET yet?",
      href: "/sign-up?role=vendor",
      label: "Claim your free storefront",
    },
  },
  admin: {
    eyebrow: "GLAMNET staff",
    title: "Admin sign-in",
    lede: "Review vendor applications and documents, and step in on bookings.",
    reassurance: "Admin access is granted by email allowlist only. Any other account is turned away.",
    signUp: null,
  },
} as const;

/**
 * One sign-in, several doors.
 *
 * /sign-in, /sign-in/customer, /sign-in/vendor and /admin/login are the same
 * form with words for whoever is arriving. What someone can reach afterwards
 * is decided by their account's role, never by the door — so choosing the
 * "wrong" one is a wording difference, not a privilege. The admin door grants
 * nothing: ADMIN comes only from the ADMIN_EMAILS allowlist on the server.
 */
export async function SignInScreen({
  audience,
  searchParams,
}: {
  audience: keyof typeof COPY;
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const isAdminDoor = audience === "admin";
  const next = safeNext(params.next, isAdminDoor ? "/admin" : "/account");
  const viewer = await getSessionUser();
  // Someone already signed in goes straight on — except a non-admin at the
  // admin door, who would only bounce off /admin. Tell them instead.
  if (viewer && !(isAdminDoor && viewer.role !== "ADMIN")) redirect(next);

  const copy = COPY[audience];

  if (viewer) {
    return (
      <AuthLayout
        eyebrow={copy.eyebrow}
        title={copy.title}
        lede={copy.lede}
        reassurance={copy.reassurance}
        footer={
          <Link href="/account" className="font-semibold text-accent-700 hover:underline">
            Back to my account
          </Link>
        }
      >
        <div role="alert" className="rounded-glam border-l-4 border-warning bg-sunken p-4 text-sm text-ink">
          You&rsquo;re signed in as <strong>{viewer.email}</strong>, which is not an admin account.
          Sign out, then sign in with an email on the admin list.
        </div>
        <form action="/auth/sign-out" method="post" className="mt-4">
          <input type="hidden" name="next" value="/admin/login" />
          <button
            type="submit"
            className="min-h-12 w-full rounded-full bg-metal text-sm font-bold text-metal-ink shadow-card transition duration-[180ms] ease-glam hover:brightness-105"
          >
            Sign out
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow={copy.eyebrow}
      title={copy.title}
      lede={copy.lede}
      reassurance={copy.reassurance}
      footer={
        copy.signUp === null ? (
          <>
            Not GLAMNET staff?{" "}
            <Link href="/sign-in" className="font-semibold text-accent-700 hover:underline">
              Go to the main sign-in
            </Link>
          </>
        ) : (
        <>
          {copy.signUp.text}{" "}
          <Link href={copy.signUp.href} className="font-semibold text-accent-700 hover:underline">
            {copy.signUp.label}
          </Link>
          {audience === "vendor" ? (
            <span className="mt-2 block">
              Booking an appointment?{" "}
              <Link href="/sign-in/customer" className="font-semibold text-accent-700 hover:underline">
                Customer sign-in
              </Link>
            </span>
          ) : null}
        </>
        )
      }
    >
      {params.error === "link-expired" ? (
        <p role="alert" className="mb-5 rounded-glam border-l-4 border-warning bg-sunken p-3 text-sm text-ink">
          That link has expired or was already used. Request a new one below.
        </p>
      ) : null}
      {/* An admin has no public sign-up to go through, so the admin door may
          create the login on first use. That grants nothing by itself: an
          email off the allowlist just gets an ordinary customer account, which
          /sign-up would have given them anyway. */}
      <SignInForm next={next} allowCreate={isAdminDoor} showGoogle={!isAdminDoor} />
    </AuthLayout>
  );
}
