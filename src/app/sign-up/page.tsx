import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { AuthLayout } from "@/components/auth-layout";
import { SignUpForm } from "./sign-up-form";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  if (await getSessionUser()) redirect("/account");

  const hubs = await prisma.hub.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, sector: true, city: true },
  });

  return (
    <AuthLayout
      title="Create your account"
      lede="Book beauty services at your door, or join as a provider."
      reassurance="Provider accounts are vetted before they can take work."
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
      <SignUpForm hubs={hubs} />
    </AuthLayout>
  );
}
