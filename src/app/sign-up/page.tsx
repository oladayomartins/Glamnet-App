import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AuthLayout } from "@/components/auth-layout";
import { SignUpForm } from "./sign-up-form";

export const dynamic = "force-dynamic";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const [{ role }] = await Promise.all([searchParams]);
  if (await getSessionUser()) redirect("/account");

  // Arriving from the vendor landing page preselects that side of the form,
  // so the choice is not made twice. It is only a default: the account's real
  // role still comes from what is submitted and is verified server-side.
  const vendorFirst = role === "vendor";

  return (
    <AuthLayout
      eyebrow={vendorFirst ? "For pros" : "Join GLAMNET"}
      title={vendorFirst ? "Claim your free storefront" : "Create your account"}
      lede={
        vendorFirst
          ? "Your own booking page, your prices, and 0% commission on clients from your link."
          : "Book verified beauty pros across the UK — at their studio or at your door."
      }
      reassurance="Every pro is checked before their storefront goes live."
      footer={
        <>
          Already have an account?{" "}
          <Link href={vendorFirst ? "/sign-in/vendor" : "/sign-in"} className="font-semibold text-accent-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm
        initialIntent={vendorFirst ? "PROVIDER" : "CUSTOMER"}
      />
    </AuthLayout>
  );
}
