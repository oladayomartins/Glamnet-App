import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { getSessionUser } from "@/lib/auth/session";
import { LEGAL } from "@/lib/legal";
import { ENQUIRY_CATEGORIES, type EnquirerRole } from "@/lib/domain/support-enquiry";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact support",
  description: "Send the GLAMNET team a message about a booking, a payment, your account or selling on GLAMNET.",
  alternates: { canonical: "/support/contact" },
};

/**
 * The contact form. Signed-in people get their name, email and role filled
 * in; links from elsewhere can preselect a category and booking, e.g.
 * /support/contact?category=BOOKING&booking=abc123.
 */
export default async function ContactPage({ searchParams }: PageProps<"/support/contact">) {
  const params = await searchParams;
  const user = await getSessionUser().catch(() => null);
  const role: EnquirerRole = user?.role === "PROVIDER" ? "VENDOR" : user?.role === "CUSTOMER" ? "CUSTOMER" : "OTHER";
  const category = typeof params.category === "string" ? params.category : "";
  const booking = typeof params.booking === "string" ? params.booking.slice(0, 60) : "";

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      <Link href="/support" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft size={14} aria-hidden /> Help centre
      </Link>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em] text-ink">Contact support</h1>
        <p className="mt-2 text-[15px] text-ink-muted">
          Tell us what it&rsquo;s about and we&rsquo;ll reply by email, usually within one working day. You can also
          email <a href={`mailto:${LEGAL.contactEmail}`} className="font-semibold text-accent-700">{LEGAL.contactEmail}</a>.
        </p>
      </header>
      <ContactForm
        initial={{
          role,
          category: ENQUIRY_CATEGORIES.some((entry) => entry.value === category) ? category : "",
          bookingRef: booking,
          name: user?.name ?? "",
          email: user?.email ?? "",
        }}
        signedIn={Boolean(user)}
        web3FormsKey={process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY?.trim() ?? ""}
      />
    </div>
  );
}
