import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
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

  const hubs = await prisma.hub.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, sector: true, city: true },
  });

  return (
    <AuthLayout
      title={vendorFirst ? "Apply as a vendor" : "Create your account"}
      lede={
        vendorFirst
          ? "Set your own hours and take bookings in your sector."
          : "Book beauty services at your door, or join as a vendor."
      }
      reassurance="Vendor accounts are vetted before they can take work."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="font-semibold text-brand-700 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm
        hubs={hubs}
        initialIntent={vendorFirst ? "PROVIDER" : "CUSTOMER"}
      />
    </AuthLayout>
  );
}
