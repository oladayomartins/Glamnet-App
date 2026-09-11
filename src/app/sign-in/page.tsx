import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { Card } from "@/components/ui";
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
    <div className="mx-auto max-w-md py-8">
      <h1 className="font-display text-2xl font-bold text-ink">Welcome back</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Sign in to book, or to pick up work.
      </p>

      {error === "link-expired" ? (
        <p
          role="alert"
          className="mt-4 rounded-glam border-l-4 border-warning bg-sunken p-3 text-sm text-ink"
        >
          That link has expired. Sign in again to get a new one.
        </p>
      ) : null}

      <Card className="mt-5 p-5">
        <SignInForm next={next ?? "/account"} />
      </Card>

      <p className="mt-4 text-center text-sm text-ink-muted">
        New to GLAMNET?{" "}
        <Link href="/sign-up" className="font-semibold text-brand-700 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
