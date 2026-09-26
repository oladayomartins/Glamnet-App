import Link from "next/link";
import { CalendarPanel } from "../calendar-panel";
import { requireVendorPage } from "../access";

export const dynamic = "force-dynamic";

/** The Calendar tab: the diary on its own, with a way to the working hours. */
export default async function VendorCalendarPage({ params }: PageProps<"/provider/[id]/calendar">) {
  const { id } = await params;
  await requireVendorPage(id, `/provider/${id}/calendar`);

  return (
    <div className="space-y-4">
      <CalendarPanel providerId={id} heading="Calendar" />
      <Link
        href={`/provider/${id}/availability`}
        className="flex min-h-14 items-center justify-between gap-3 rounded-glam border border-line bg-surface px-4 py-3 transition duration-[180ms] hover:bg-sunken"
      >
        <span>
          <span className="block font-semibold text-ink">Working hours and time off</span>
          <span className="block text-sm text-ink-muted">
            Requests are only sent for times inside your hours
          </span>
        </span>
        <span aria-hidden className="text-ink-muted">→</span>
      </Link>
    </div>
  );
}
