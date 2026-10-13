import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { listVendorCodes } from "@/lib/server/vendor-codes";
import { siteUrl } from "@/lib/site";
import { requireVendorPage } from "../access";
import { CodeManager } from "./code-manager";

export const dynamic = "force-dynamic";

/**
 * The vendor's own discount codes, for their storefront: a thank-you for
 * regulars, a launch offer for followers. The vendor pays for the discount.
 */
export default async function VendorCodesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireVendorPage(id, `/provider/${id}/codes`);
  const provider = await prisma.provider.findUnique({ where: { id }, select: { id: true, slug: true } });
  if (!provider) notFound();
  const codes = await listVendorCodes(id);
  const isOwner = viewer.providerId === id;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/provider/${id}/settings`} className="inline-flex min-h-11 items-center text-sm text-ink-muted hover:text-brand-700">
          ← Profile &amp; settings
        </Link>
        <h1 className="font-display text-[28px] font-bold leading-tight text-ink">Discount codes</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Make a code for your followers or regulars — like AMARA10 for 10% off. It works only on your storefront, and
          the discount comes off your price.
        </p>
      </div>
      {isOwner ? (
        <CodeManager codes={codes} storefrontUrl={provider.slug ? `${siteUrl()}/pro/${provider.slug}` : null} />
      ) : (
        <ul className="space-y-1 text-sm text-ink">
          {codes.map((code) => (
            <li key={code.id}>
              <span className="font-mono">{code.code}</span> — {code.label} · {code.schedule.toLowerCase()} · {code.uses} uses
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
