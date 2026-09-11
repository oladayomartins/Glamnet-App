import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AuthLayout } from "@/components/auth-layout";
import { SignInForm } from "./sign-in-form";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  // Already signed in: don't show a login form, send them where they meant to go.
  if (await getSessionUser()) redirect(next ?? "/account");

  return (
    <AuthLayout
      title="Welcome back"
      lede="Sign in to book, or to pick up work."
      reassurance="Every provider on GLAMNET is vetted before they can take work."
      footer={
        <>
          New to GLAMNET?{" "}
          <Link
            href="/sign-up"
            className="font-semibold text-brand-700 hover:underline"
          >
            Create an account
          </Link>
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
