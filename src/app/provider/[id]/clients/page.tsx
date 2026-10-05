import Link from "next/link";
import { notFound } from "next/navigation";
import { MagnifyingGlass, NotePencil, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/server/prisma";
import { listClients } from "@/lib/server/clients";
import { Card, EmptyState } from "@/components/ui";
import { formatDay, formatDayTime, formatMoney } from "@/lib/format";
import { requireVendorPage } from "../access";

export const dynamic = "force-dynamic";

/**
 * The vendor's clients: everyone they have had a booking with, coming-up
 * first, with their private note on each. Names only — the client's contact
 * details stay with GLAMNET.
 */
export default async function VendorClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ id }, { q = "" }] = await Promise.all([params, searchParams]);
  await requireVendorPage(id, `/provider/${id}/clients`);
  const provider = await prisma.provider.findUnique({ where: { id }, select: { id: true } });
  if (!provider) notFound();

  const query = q.slice(0, 80);
  const clients = await listClients(id, query);
  const repeat = clients.filter((client) => client.visits > 1).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[28px] font-bold leading-tight text-ink">Clients</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Everyone you&rsquo;ve had a booking with, and your private notes on them.
          {clients.length > 0 && !query
            ? ` ${clients.length} ${clients.length === 1 ? "client" : "clients"}${repeat > 0 ? ` · ${repeat} came back` : ""}.`
            : ""}
        </p>
      </div>

      <form role="search" className="focus-shell flex min-h-12 items-center gap-2 rounded-full border border-line bg-surface px-4">
        <MagnifyingGlass size={18} className="text-ink-muted" aria-hidden />
        <label htmlFor="client-search" className="sr-only">
          Search clients by name
        </label>
        <input
          id="client-search"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search by name"
          className="min-h-11 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted/70"
        />
      </form>

      {clients.length === 0 ? (
        <EmptyState icon={<UsersThree size={24} weight="light" />}>
          {query
            ? `No clients called “${query}”.`
            : "No clients yet. Everyone who books you will appear here, with space for your own notes."}
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {clients.map((client) => (
            <li key={client.customerId}>
              <Link href={`/provider/${id}/clients/${client.customerId}`} className="block">
                <Card className="p-4 transition duration-[180ms] hover:border-accent-500/60">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-[17px] font-semibold text-ink">{client.name}</span>
                    <span className="text-xs text-ink-muted" data-numeric>
                      {client.visits === 0 ? "New client" : `${client.visits} ${client.visits === 1 ? "visit" : "visits"}`}
                      {client.earnedMinor > 0 ? ` · ${formatMoney(client.earnedMinor)}` : ""}
                      {client.averageRating !== null ? ` · gave ${client.averageRating.toFixed(1)}★` : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">
                    {client.nextBookingAt ? (
                      <span className="font-semibold text-ink">Next: {formatDayTime(client.nextBookingAt)}</span>
                    ) : client.lastVisitAt ? (
                      `Last visit ${formatDay(client.lastVisitAt)}`
                    ) : (
                      "No visits yet"
                    )}
                    {client.noShows > 0 ? ` · ${client.noShows} no-show${client.noShows === 1 ? "" : "s"}` : ""}
                    {client.cancellations > 0
                      ? ` · ${client.cancellations} cancelled`
                      : ""}
                  </p>
                  {client.note ? (
                    <p className="mt-2 flex items-start gap-1.5 text-sm text-ink">
                      <NotePencil size={15} className="mt-0.5 shrink-0 text-accent-700" aria-hidden />
                      <span className="line-clamp-2">{client.note}</span>
                    </p>
                  ) : null}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
