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
} as const;

/**
 * One sign-in, three doors.
 *
 * /sign-in, /sign-in/customer and /sign-in/vendor are the same form with
 * words for whoever is arriving. Where someone lands afterwards is decided by
 * their account's role, never by the door — so choosing the "wrong" one is a
 * wording difference, not a privilege.
 */
export async function SignInScreen({
  audience,
  searchParams,
}: {
  audience: keyof typeof COPY;
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await getSessionUser()) redirect(next);

  const copy = COPY[audience];

  return (
    <AuthLayout
      eyebrow={copy.eyebrow}
      title={copy.title}
      lede={copy.lede}
      reassurance={copy.reassurance}
      footer={
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
      }
    >
      {params.error === "link-expired" ? (
        <p role="alert" className="mb-5 rounded-glam border-l-4 border-warning bg-sunken p-3 text-sm text-ink">
          That link has expired or was already used. Request a new one below.
        </p>
      ) : null}
      <SignInForm next={next} />
    </AuthLayout>
  );
}
