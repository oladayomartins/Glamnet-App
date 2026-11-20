import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/server/prisma";
import { AdminHeader } from "../_components/bits";
import { PAGE_SIZE, Pager, pageFrom } from "../_components/pager";
import { ENQUIRER_ROLES, categoryByValue } from "@/lib/domain/support-enquiry";
import { ResolveButton } from "./resolve-button";

export const dynamic = "force-dynamic";

export const metadata = { title: "Support inbox" };

const TABS = [
  { key: "OPEN", label: "Open" },
  { key: "RESOLVED", label: "Resolved" },
] as const;

/** Messages from the contact form: urgent first, then oldest open first. */
export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await requireRole("ADMIN", "/admin/support");
  const params = await searchParams;
  const status = params.status === "RESOLVED" ? "RESOLVED" : "OPEN";
  const page = pageFrom(params.page);

  const [enquiries, total, openCount] = await Promise.all([
    prisma.supportEnquiry.findMany({
      where: { status },
      orderBy: status === "OPEN" ? [{ urgent: "desc" }, { createdAt: "asc" }] : [{ resolvedAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.supportEnquiry.count({ where: { status } }),
    prisma.supportEnquiry.count({ where: { status: "OPEN" } }),
  ]);

  const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" });

  return (
    <div>
      <AdminHeader
        title="Support inbox"
        lede="Messages from the contact form. Reply by email — each one's sender is the reply-to — then mark it resolved."
      />

      <nav aria-label="Status" className="mb-5 flex gap-1.5">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/support?status=${tab.key}`}
            aria-current={status === tab.key ? "page" : undefined}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium ${
              status === tab.key ? "bg-metal text-metal-ink" : "bg-surface text-ink-muted ring-1 ring-line hover:text-ink"
            }`}
          >
            {tab.label}
            {tab.key === "OPEN" ? <span className="font-mono text-[11px] opacity-70">{openCount}</span> : null}
          </Link>
        ))}
      </nav>

      {enquiries.length === 0 ? (
        <p className="rounded-glam border border-line bg-surface p-6 text-sm text-ink-muted">
          {status === "OPEN" ? "Nothing waiting. Inbox zero." : "Nothing resolved yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {enquiries.map((enquiry) => {
            const category = categoryByValue(enquiry.category);
            const role = ENQUIRER_ROLES.find((entry) => entry.value === enquiry.role)?.label ?? enquiry.role;
            return (
              <li
                key={enquiry.id}
                className={`rounded-glam border bg-surface p-4 ${enquiry.urgent && status === "OPEN" ? "border-emergency/60" : "border-line"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      {enquiry.urgent ? (
                        <span className="rounded-full bg-emergency px-2 py-0.5 text-[11px] font-bold text-on-emergency">URGENT</span>
                      ) : null}
                      <span className="font-mono text-xs text-ink-muted">{enquiry.reference}</span>
                      <span className="font-semibold text-ink">
                        {category?.label ?? enquiry.category} — {enquiry.topic}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-ink">
                      {enquiry.name} ·{" "}
                      <a
                        href={`mailto:${enquiry.email}?subject=${encodeURIComponent(`Re: ${enquiry.reference} · ${enquiry.topic}`)}`}
                        className="font-semibold text-accent-700 hover:underline"
                      >
                        {enquiry.email}
                      </a>{" "}
                      <span className="text-ink-muted">· {role}</span>
                    </p>
                    <p className="text-xs text-ink-muted">
                      {when.format(enquiry.createdAt)}
                      {enquiry.bookingRef ? (
                        <>
                          {" · booking "}
                          <Link href={`/admin/bookings/${enquiry.bookingRef}`} className="font-mono text-accent-700 hover:underline">
                            {enquiry.bookingRef}
                          </Link>
                        </>
                      ) : null}
                      {enquiry.resolvedAt ? ` · resolved ${when.format(enquiry.resolvedAt)} by ${enquiry.resolvedBy}` : ""}
                    </p>
                  </div>
                  <ResolveButton id={enquiry.id} status={enquiry.status} />
                </div>
                <p className="mt-3 whitespace-pre-wrap rounded-glam bg-sunken p-3 text-sm text-ink">{enquiry.message}</p>
              </li>
            );
          })}
        </ul>
      )}

      <Pager page={page} total={total} hrefFor={(next) => `/admin/support?status=${status}&page=${next}`} label="Enquiries" />
    </div>
  );
}
