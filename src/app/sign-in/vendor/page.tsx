import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AuthLayout } from "@/components/auth-layout";
import { SignInForm } from "../sign-in-form";

export const dynamic = "force-dynamic";

/**
 * Vendor sign-in (§S-01).
 *
 * The form is the shared one and the credentials are checked the same way. The
 * only thing this door changes is the words and where an unspecified sign-in
 * lands afterwards — the account's real role decides what it can actually do,
 * so arriving through the wrong door is a wrong turn, not a privilege.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  if (await getSessionUser()) redirect(next ?? "/account");

  return (
    <AuthLayout
      title="Back to work"
      lede="Sign in to pick up booking requests, manage your calendar and see what you have earned."
      reassurance="Turning work off stops new requests. Jobs you have accepted are unaffected."
      footer={
        <>
          Not signed up as a vendor yet?{" "}
          <Link
            href="Not signed up as a vendor yet?_HREF"
            className="font-semibold text-brand-700 hover:underline"
          >
            Not signed up as a vendor yet?_LINK
          </Link>
          <span className="mt-2 block">
            Not what you meant?{" "}
            <Link href="/sign-in" className="font-semibold text-brand-700 hover:underline">
              Sign in as a customer
            </Link>
          </span>
        </>
      }
    >
      {error === "link-expired" ? (
        <p
          role="alert"
          className="mb-4 rounded-glam border-l-4 border-warning bg-sunken p-3 text-sm text-ink"
        >
          That link has expired. Sign in again to get a new one.
        </p>
      ) : null}

      <SignInForm next={next ?? "/account"} />
    </AuthLayout>
  );
}
