import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { Card } from "@/components/ui";
import { SignUpForm } from "./sign-up-form";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  if (await getSessionUser()) redirect("/account");

  const hubs = await prisma.hub.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, sector: true, city: true },
  });

  return (
    <div className="mx-auto max-w-md py-8">
      <h1 className="font-display text-2xl font-bold text-ink">
        Create your account
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        Book beauty services at your door, or join as a professional.
      </p>

      <Card className="mt-5 p-5">
        <SignUpForm hubs={hubs} />
      </Card>

      <p className="mt-4 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
