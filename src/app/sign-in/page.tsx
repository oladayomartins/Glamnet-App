import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Briefcase, UserCircle } from "@phosphor-icons/react/dist/ssr";
import { getSessionUser } from "@/lib/auth/session";
import { AuthLayout } from "@/components/auth-layout";

export const dynamic = "force-dynamic";

/**
 * Who is signing in (§S-01).
 *
 * Customers and vendors want different things from the same word. A customer
 * signing in is going back to a booking; a vendor is going to work. Asking
 * once here means each of them lands on a page written for them, rather than
 * on a shared form that has to be vague enough to suit both.
 *
 * It is a routing question, not an authentication one — the account's real
 * role comes from the database either way, so choosing the wrong door gets a
 * vendor to their dashboard regardless. Nothing here can be used to claim a
 * role that has not been granted.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  // Already signed in: don't ask who they are, send them where they meant to go.
  if (await getSessionUser()) redirect(next ?? "/account");

  const carry = (path: string) =>
    next ? `${path}?next=${encodeURIComponent(next)}` : path;

  return (
    <AuthLayout
      title="Welcome back"
      lede="Tell us which side of GLAMNET you are on and we will take you to the right place."
      reassurance="Every vendor on GLAMNET is vetted before they can take work."
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

      <div className="space-y-3">
        <RoleCard
          href={carry("/sign-in/customer")}
          icon={<UserCircle size={22} weight="light" aria-hidden />}
          title="I am a customer"
          body="Book a vendor, track an appointment, or rate work that is done."
        />
        <RoleCard
          href={carry("/sign-in/vendor")}
          icon={<Briefcase size={22} weight="light" aria-hidden />}
          title="I am a vendor"
          body="Take booking requests, manage your calendar and see your earnings."
        />
      </div>
    </AuthLayout>
  );
}

function RoleCard({
  href,
  icon,
  title,
  body,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-glam border border-line bg-surface p-4 shadow-card transition duration-[180ms] ease-glam hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-raised"
    >
      <span
        aria-hidden
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-sm text-ink-muted">{body}</span>
      </span>
      <ArrowRight
        size={16}
        weight="light"
        aria-hidden
        className="shrink-0 text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-brand-700"
      />
    </Link>
  );
}
