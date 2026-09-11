import Link from "next/link";
import { Card } from "@/components/ui";

export default function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-lg py-12">
      <Card className="p-6 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">
          Not available on this account
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          You are signed in, but this area belongs to a different kind of
          account.
        </p>
        <Link
          href="/account"
          className="mt-5 inline-flex rounded-glam-sm bg-brand-700 px-4 py-2.5 text-sm font-semibold text-on-brand"
        >
          Go to your account
        </Link>
      </Card>
    </div>
  );
}
