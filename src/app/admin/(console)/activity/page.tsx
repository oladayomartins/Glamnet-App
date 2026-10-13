import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/server/prisma";
import { AdminHeader, fieldClass } from "../_components/bits";
import { ActivityList } from "../_components/activity-list";
import { PAGE_SIZE, Pager, listHref, pageFrom } from "../_components/pager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Activity log" };

/** Action families, by the prefix every action name starts with. */
const AREAS = [
  { key: "vendor", label: "Vendors" },
  { key: "document", label: "Documents" },
  { key: "account", label: "Accounts" },
  { key: "booking", label: "Bookings" },
  { key: "ad", label: "Ads" },
  { key: "campaign", label: "Campaigns" },
  { key: "promo", label: "Promo codes" },
  { key: "category", label: "Categories" },
  { key: "service", label: "Services" },
  { key: "city", label: "Cities" },
  { key: "pricing", label: "Pricing" },
  { key: "finance", label: "Finance" },
  { key: "export", label: "Exports" },
] as const;

/** A YYYY-MM-DD value as the start of that UK day, or null. */
function dayStart(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Every admin action, newest first. Read-only: the log cannot be edited. */
export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; actor?: string; q?: string; from?: string; to?: string; page?: string }>;
}) {
  await requireRole("ADMIN", "/admin/activity");
  const params = await searchParams;
  const area = AREAS.some((entry) => entry.key === params.area) ? params.area! : "";
  const actor = params.actor?.trim().toLowerCase() ?? "";
  const q = params.q?.trim().slice(0, 80) ?? "";
  const from = dayStart(params.from);
  const toStart = dayStart(params.to);
  const to = toStart ? new Date(toStart.getTime() + 86_400_000) : null;
  const page = pageFrom(params.page);

  const where: Prisma.AdminAuditLogWhereInput = {
    ...(area ? { action: { startsWith: `${area}.` } } : {}),
    ...(actor ? { actorEmail: actor } : {}),
    ...(q
      ? {
          OR: [
            { summary: { contains: q, mode: "insensitive" } },
            { targetId: q },
            { action: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
  };

  const [entries, total, actors] = await Promise.all([
    prisma.adminAuditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({ distinct: ["actorEmail"], select: { actorEmail: true }, orderBy: { actorEmail: "asc" } }),
  ]);
  const filters = { area, actor, q, from: params.from ?? "", to: params.to ?? "" };
  const filtered = Boolean(area || actor || q || from || to);

  return (
    <div>
      <AdminHeader
        title="Activity log"
        lede="Who approved, suspended, refunded, edited or sent what, and when. Each entry links to what it changed."
      />
      <form className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_9rem_9rem_auto] lg:items-end">
        <label className="block">
          <span className="text-xs text-ink-muted">Search</span>
          <input name="q" defaultValue={q} placeholder="Name, email, reason or id" className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-xs text-ink-muted">Area</span>
          <select name="area" defaultValue={area} className={fieldClass}>
            <option value="">Everything</option>
            {AREAS.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-ink-muted">Admin</span>
          <select name="actor" defaultValue={actor} className={fieldClass}>
            <option value="">Anyone</option>
            {actors.map(({ actorEmail }) => (
              <option key={actorEmail} value={actorEmail}>
                {actorEmail}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-ink-muted">From</span>
          <input type="date" name="from" defaultValue={params.from ?? ""} className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-xs text-ink-muted">To</span>
          <input type="date" name="to" defaultValue={params.to ?? ""} className={fieldClass} />
        </label>
        <div className="flex gap-2">
          <button type="submit" className="min-h-10 rounded-full bg-metal px-5 text-sm font-bold text-metal-ink">
            Filter
          </button>
          {filtered ? (
            <Link href="/admin/activity" className="inline-flex min-h-10 items-center px-2 text-sm text-accent-700 hover:underline">
              Clear
            </Link>
          ) : null}
        </div>
      </form>
      <p className="mb-2 text-xs text-ink-muted" data-numeric>
        {total.toLocaleString("en-GB")} {total === 1 ? "entry" : "entries"}
        {filtered ? " match" : ""}
      </p>
      <ActivityList entries={entries} empty={filtered ? "Nothing matches these filters." : undefined} />
      <Pager page={page} total={total} label="Activity pages" hrefFor={(next) => listHref("/admin/activity", { ...filters, page: next })} />
    </div>
  );
}
