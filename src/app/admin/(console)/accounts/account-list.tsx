"use client";

import Link from "next/link";
import { Button, Card, EmptyState, Pill } from "@/components/ui";
import { ErrorNote } from "../_components/bits";
import { useAdminAction } from "../_components/use-admin-action";

export interface AccountRow {
  id: string;
  email: string;
  role: string;
  name: string;
  joined: string;
  bookings: number;
  vendorStatus: string | null;
  vendorSlug: string | null;
  suspended: boolean;
  suspendedReason: string;
}

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function AccountList({ rows }: { rows: AccountRow[] }) {
  const { run, busy, error } = useAdminAction();

  const suspend = (row: AccountRow) => {
    const reason = window.prompt(
      `Suspend ${row.email}? They will be signed out of everything${row.role === "PROVIDER" ? " and their storefront goes offline" : ""}.\n\nReason (shown to them):`,
      "",
    );
    if (reason === null) return;
    void run(row.id, `/api/admin/accounts/${row.id}`, "PATCH", { suspended: true, reason });
  };

  if (rows.length === 0) return <EmptyState>No accounts match.</EmptyState>;

  return (
    <div className="space-y-3">
      <ErrorNote>{error}</ErrorNote>
      <Card className="divide-y divide-line">
        {rows.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink">{row.name || row.email.split("@")[0]}</span>
                <Pill tone={row.role === "ADMIN" ? "positive" : "neutral"}>{row.role.toLowerCase()}</Pill>
                {row.vendorStatus ? <Pill tone={row.vendorStatus === "APPROVED" ? "positive" : "neutral"}>vendor {row.vendorStatus.toLowerCase()}</Pill> : null}
                {row.suspended ? <Pill tone="muted">suspended</Pill> : null}
              </div>
              <p className="mt-0.5 font-mono text-xs text-ink-muted">{row.email}</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Joined {DAY.format(new Date(row.joined))} · {row.bookings} booking{row.bookings === 1 ? "" : "s"}
                {row.vendorSlug ? (
                  <>
                    {" · "}
                    <Link href={`/pro/${row.vendorSlug}`} target="_blank" className="text-accent-700 hover:underline">
                      /pro/{row.vendorSlug}
                    </Link>
                  </>
                ) : null}
              </p>
              {row.suspended && row.suspendedReason ? (
                <p className="mt-0.5 text-xs text-warning">Reason: {row.suspendedReason}</p>
              ) : null}
            </div>
            {row.role === "ADMIN" ? (
              <span className="text-xs text-ink-muted">Managed in ADMIN_EMAILS</span>
            ) : row.suspended ? (
              <Button
                variant="secondary"
                disabled={busy === row.id}
                onClick={() => run(row.id, `/api/admin/accounts/${row.id}`, "PATCH", { suspended: false })}
              >
                {busy === row.id ? "Saving…" : "Reinstate"}
              </Button>
            ) : (
              <Button variant="secondary" className="text-warning" disabled={busy === row.id} onClick={() => suspend(row)}>
                {busy === row.id ? "Saving…" : "Suspend"}
              </Button>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}
