import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/server/prisma";
import { AdminHeader, fieldClass } from "../_components/bits";
import { PAGE_SIZE, Pager, listHref, pageFrom } from "../_components/pager";
import { AccountList, type AccountRow } from "./account-list";

export const dynamic = "force-dynamic";

export const metadata = { title: "Accounts" };

const ROLES = [
  { key: "ALL", label: "Everyone" },
  { key: "CUSTOMER", label: "Customers" },
  { key: "PROVIDER", label: "Vendors" },
  { key: "ADMIN", label: "Admins" },
  { key: "SUSPENDED", label: "Suspended" },
] as const;
type RoleTab = (typeof ROLES)[number]["key"];

/** Every login on the platform, with suspension controls. */
export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; q?: string; page?: string }>;
}) {
  await requireRole("ADMIN", "/admin/accounts");
  const params = await searchParams;
  const tab: RoleTab = ROLES.some((entry) => entry.key === params.role) ? (params.role as RoleTab) : "ALL";
  const q = params.q?.trim() ?? "";
  const page = pageFrom(params.page);

  const where: Prisma.AppUserWhereInput = {
    ...(tab === "SUSPENDED" ? { suspendedAt: { not: null } } : tab === "ALL" ? {} : { role: tab }),
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { customer: { name: { contains: q, mode: "insensitive" } } },
            { provider: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.appUser.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        customer: { select: { name: true, _count: { select: { bookings: true } } } },
        provider: { select: { name: true, slug: true, approvalStatus: true, _count: { select: { bookings: true } } } },
      },
    }),
    prisma.appUser.count({ where }),
  ]);

  const rows: AccountRow[] = users.map((user) => ({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.provider?.name ?? user.customer?.name ?? "",
    joined: user.createdAt.toISOString(),
    bookings: (user.customer?._count.bookings ?? 0) + (user.provider?._count.bookings ?? 0),
    vendorStatus: user.provider?.approvalStatus ?? null,
    vendorSlug: user.provider?.slug ?? null,
    suspended: user.suspendedAt !== null,
    suspendedReason: user.suspendedReason,
  }));

  const href = (role: RoleTab) => listHref("/admin/accounts", { role: role === "ALL" ? null : role, q });

  return (
    <div>
      <AdminHeader
        title="Accounts"
        lede="Everyone with a GLAMNET login. Suspending an account signs the person out of everything and, for a vendor, takes their storefront offline."
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Account type" className="flex flex-wrap gap-1.5">
          {ROLES.map(({ key, label }) => (
            <Link
              key={key}
              href={href(key)}
              aria-current={tab === key ? "page" : undefined}
              className={`inline-flex min-h-10 items-center rounded-full px-3.5 text-sm font-medium transition duration-[180ms] ease-glam ${
                tab === key ? "bg-metal text-metal-ink" : "bg-surface text-ink-muted ring-1 ring-line hover:text-ink"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap gap-2">
          {tab !== "PROVIDER" && tab !== "ADMIN" ? (
            <a
              href={`/api/admin/exports/customers?${new URLSearchParams({ q, suspended: tab === "SUSPENDED" ? "1" : "" }).toString()}`}
              download
              className="inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold text-accent-700 ring-1 ring-line hover:bg-sunken"
            >
              Customers CSV
            </a>
          ) : null}
          {tab === "ALL" || tab === "PROVIDER" ? (
            <a href={`/api/admin/exports/vendors?${new URLSearchParams({ q }).toString()}`} download className="inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold text-accent-700 ring-1 ring-line hover:bg-sunken">
              Vendors CSV
            </a>
          ) : null}
        </div>
        <form className="w-full sm:w-64">
          <input type="hidden" name="role" value={tab} />
          <input name="q" defaultValue={q} placeholder="Search name or email" className={`${fieldClass} mt-0`} />
        </form>
      </div>
      <AccountList rows={rows} />
      <Pager
        page={page}
        total={total}
        label="Account pages"
        hrefFor={(next) => listHref("/admin/accounts", { role: tab === "ALL" ? null : tab, q, page: next })}
      />
    </div>
  );
}
