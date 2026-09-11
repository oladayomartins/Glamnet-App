import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AuthLayout } from "@/components/auth-layout";
import { SignInForm } from "../sign-in-form";

export const dynamic = "force-dynamic";

/**
 * Customer sign-in (§S-01).
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
      title="Welcome back"
      lede="Sign in to book a vendor, track an appointment or rate work that is done."
      reassurance="Your address is only released to a vendor once they are on their way."
      footer={
        <>
          No account yet?{" "}
          <Link
            href="No account yet?_HREF"
            className="font-semibold text-brand-700 hover:underline"
          >
            No account yet?_LINK
          </Link>
          <span className="mt-2 block">
            Not what you meant?{" "}
            <Link href="/sign-in" className="font-semibold text-brand-700 hover:underline">
              Sign in as a vendor
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
