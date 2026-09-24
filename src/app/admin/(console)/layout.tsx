import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { AdminNav } from "./_components/admin-nav";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · GLAMNET admin" },
  robots: { index: false, follow: false },
};

/**
 * The admin console shell: a section rail beside the page.
 *
 * The role check here keeps a non-admin from seeing even the rail; every page
 * and every /api/admin route checks again on its own, because a layout does
 * not re-run on client navigation and is not a security boundary by itself.
 */
export default async function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireRole("ADMIN", "/admin");
  return (
    <div data-page-width="wide" className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
      <AdminNav email={admin.email} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
