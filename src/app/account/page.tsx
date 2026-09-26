import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarBlank, CalendarCheck, LockKey, MagnifyingGlass, SealCheck, Star } from "@phosphor-icons/react/dist/ssr";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/server/prisma";
import { listCategories } from "@/lib/server/categories";
import { listDirectory } from "@/lib/server/storefront";
import { BookingTypeTag, Card, EmptyState, SectionTitle, LifecycleChip } from "@/components/ui";
import { CampaignBanner } from "@/components/campaign-banner";
import { GlamImage } from "@/components/glam-image";
import { formatCustomerDayTime, formatMoney } from "@/lib/format";
import { formatMiles, milesToKm } from "@/lib/domain/postcode";
import { NearYou } from "./near-you";
import { DetailsForm } from "./details-form";
import { PhotoPicker } from "./photo-picker";
import { PushPrompt } from "@/components/push-prompt";
import { MarketingEmails } from "@/components/marketing-emails";

export const dynamic = "force-dynamic";

/** The three ways a customer looks for one of their own bookings (§C-11). */
const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
] as const;

type Tab = (typeof TABS)[number]["key"];

/** Where every signed-in user lands: their role decides what they see. */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [user, { tab: requestedTab }] = await Promise.all([
    requireUser("/account"),
    searchParams,
  ]);

  // Every sign-in, sign-up and email link lands here, so this is where each
  // account type is sent to its own dashboard. The role was fixed at sign-up
  // and is read from the database, never from the URL. /provider picks the
  // storefront wizard, the review screen or the live dashboard for a pro.
  if (user.role === "PROVIDER") redirect("/provider");
  if (user.role === "ADMIN") redirect("/admin");

  const tab: Tab = TABS.some((entry) => entry.key === requestedTab)
    ? (requestedTab as Tab)
    : "upcoming";

  const now = new Date();
  // Cancelled and disputed bookings leave the timeline entirely rather than
  // sitting in Past: a customer looking for what happened wants the ones that
  // happened.
  const closed = ["CANCELLED", "EXPIRED", "DISPUTED", "NO_SHOW"];
  const tabFilter =
    tab === "cancelled"
      ? { status: { in: closed } }
      : tab === "past"
        ? {
            status: { notIn: closed },
            appointmentStartAt: { lt: now },
          }
        : {
            status: { notIn: closed },
            appointmentStartAt: { gte: now },
          };

  const [bookings, customer, categories, everBooked] = await Promise.all([
    user.customerId
      ? prisma.booking.findMany({
          where: { customerId: user.customerId, ...tabFilter },
          // Upcoming reads forwards from now; the other two read backwards
          // from the most recent.
          orderBy: { appointmentStartAt: tab === "upcoming" ? "asc" : "desc" },
          take: 20,
          include: { items: true, provider: { select: { name: true } } },
        })
      : Promise.resolve([]),
    user.customerId ? prisma.customer.findUnique({ where: { id: user.customerId } }) : Promise.resolve(null),
    listCategories(),
    user.customerId ? prisma.booking.count({ where: { customerId: user.customerId } }) : Promise.resolve(0),
  ]);

  // Pros near the remembered postcode, for the first thing on the page.
  const home =
    customer?.latitude != null && customer.longitude != null
      ? { lat: customer.latitude, lng: customer.longitude }
      : null;
  const nearby = home ? (await listDirectory({ near: home, radiusKm: milesToKm(10) })).slice(0, 4) : [];

  // Saved vendors, newest first. Only live storefronts are listed: a vendor
  // who has paused or been unapproved since cannot be booked, so linking to
  // them would be a dead end wearing a heart.
  const saved = customer
    ? await prisma.savedVendor.findMany({
        where: {
          customerId: customer.id,
          provider: { approvalStatus: "APPROVED", isAcceptingWork: true, slug: { not: null } },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          provider: {
            select: { id: true, name: true, slug: true, avatarUrl: true, workspaceSector: true, hub: { select: { city: true, sector: true } } },
          },
        },
      })
    : [];
  const firstName = (customer?.name ?? "").trim().split(/\s+/)[0] || "there";
  const nearQuery = customer?.postcode ? `&near=${encodeURIComponent(customer.postcode)}` : "";

  return (
    <div data-page-width="wide" className="space-y-10 pb-6">
      {/* --- Welcome + find pros ------------------------------------------ */}
      <section className="overflow-hidden rounded-glam-lg border border-accent-500/30 bg-[radial-gradient(80%_120%_at_0%_0%,color-mix(in_oklab,var(--glam-gold)_18%,transparent),transparent_70%)] bg-surface p-6 sm:p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-700">Your GLAMNET</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-[-0.02em] text-ink sm:text-4xl">
          Hi {firstName}, who are we booking today?
        </h1>
        <p className="mt-2 max-w-xl text-[15px] text-ink-muted">
          Verified independent pros near you, with real availability. Your card is only held, and paid when
          you&rsquo;re happy.
        </p>
        <div className="mt-6 max-w-2xl">
          <NearYou savedPostcode={customer?.postcode ?? ""} />
        </div>
      </section>

      <CampaignBanner viewer="CUSTOMER" />

      {/* --- Categories ---------------------------------------------------- */}
      <section>
        <SectionTitle hint={<Link href="/salons" className="hover:text-accent-700">See everyone →</Link>}>
          Browse by specialty
        </SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/salons?hub=${category.slug}${nearQuery}`}
              className="rounded-glam border border-line bg-surface p-4 transition duration-[180ms] ease-glam hover:-translate-y-0.5 hover:border-accent-500"
            >
              <span aria-hidden className="text-2xl">{category.emoji}</span>
              <span className="mt-2 block font-display text-[15px] font-bold leading-tight text-ink">{category.name}</span>
              <span className="mt-1 block text-xs text-ink-muted">{category.blurb}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* --- Saved ----------------------------------------------------------
          Only rendered once there is something in it: an empty "Saved" shelf
          on every visit is a reminder of a feature, not a use of one. */}
      {saved.length > 0 ? (
        <section>
          <SectionTitle hint={`${saved.length} saved`}>Saved vendors</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {saved.map(({ provider }) => (
              <Link
                key={provider.id}
                href={`/pro/${provider.slug}`}
                className="rounded-glam border border-line bg-surface p-3 transition duration-[180ms] ease-glam hover:-translate-y-0.5 hover:border-accent-500"
              >
                <GlamImage
                  src={provider.avatarUrl}
                  alt={provider.name}
                  width={160}
                  height={160}
                  className="h-14 w-14 rounded-full object-cover"
                />
                <span className="mt-2 block truncate font-display text-[15px] font-bold leading-tight text-ink">
                  {provider.name}
                </span>
                <span className="mt-0.5 block truncate text-xs text-ink-muted">
                  {provider.hub.city} · {provider.workspaceSector || provider.hub.sector}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* --- Near you -------------------------------------------------------- */}
      {nearby.length > 0 ? (
        <section>
          <SectionTitle
            hint={
              <Link href={`/salons?near=${encodeURIComponent(customer!.postcode)}`} className="hover:text-accent-700">
                See all near {customer!.postcode} →
              </Link>
            }
          >
            Pros near you
          </SectionTitle>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {nearby.map((vendor) => (
              <li key={vendor.id}>
                <Link
                  href={`/pro/${vendor.slug}?via=directory`}
                  className="group block overflow-hidden rounded-glam border border-line bg-surface shadow-card transition hover:border-accent-500"
                >
                  <div className="relative aspect-[4/3]">
                    <GlamImage
                      src={vendor.lookbook[0] ?? vendor.avatarUrl}
                      alt={`Work by ${vendor.name}`}
                      width={480}
                      height={360}
                      sizes="(max-width: 640px) 100vw, 25vw"
                      className="h-full w-full object-cover"
                    />
                    {vendor.distanceKm !== null ? (
                      <span data-numeric className="absolute left-3 top-3 rounded-full bg-obsidian/85 px-2.5 py-1 text-xs font-semibold text-on-obsidian">
                        {formatMiles(vendor.distanceKm)}
                      </span>
                    ) : null}
                  </div>
                  <div className="p-3">
                    <p className="flex items-center gap-1.5 font-display font-bold text-ink">
                      {vendor.name}
                      <SealCheck size={14} weight="fill" className="text-accent-500" aria-label="Verified" />
                    </p>
                    <p className="mt-0.5 flex items-center justify-between text-xs text-ink-muted">
                      <span className="flex items-center gap-1" data-numeric>
                        <Star size={12} weight="fill" className="text-accent-500" aria-hidden />
                        {vendor.rating.toFixed(1)} · {vendor.sector}
                      </span>
                      {vendor.fromMinor !== null ? (
                        <span data-numeric className="font-bold text-accent-700">from {formatMoney(vendor.fromMinor)}</span>
                      ) : null}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* --- How it works, until the first booking ------------------------- */}
      {everBooked === 0 ? (
        <section className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: MagnifyingGlass, title: "Find your pro", body: "Browse by specialty and postcode — their looks, menus and reviews." },
            { icon: CalendarCheck, title: "Book a real slot", body: "Pick a time from their own calendar. Your card is only held." },
            { icon: LockKey, title: "Pay with your PIN", body: "Happy with the result? Give your pro your 4-digit PIN and they're paid." },
          ].map(({ icon: Icon, title, body }, index) => (
            <Card key={title} className="p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-100 text-accent-700">
                <Icon size={20} aria-hidden />
              </span>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">Step 0{index + 1}</p>
              <p className="mt-1 font-display font-semibold text-ink">{title}</p>
              <p className="mt-1 text-sm text-ink-muted">{body}</p>
            </Card>
          ))}
        </section>
      ) : null}

      <section>
        <SectionTitle hint={`${bookings.length} shown`}>Your bookings</SectionTitle>

        <div
          className="mb-3 flex flex-wrap gap-2"
          role="tablist"
          aria-label="Booking history"
        >
          {TABS.map((entry) => (
            <Link
              key={entry.key}
              href={`/account?tab=${entry.key}`}
              role="tab"
              aria-selected={tab === entry.key}
              className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition duration-[180ms] ease-glam ${
                tab === entry.key
                  ? "bg-metal text-metal-ink"
                  : "bg-surface text-ink-muted ring-1 ring-line hover:text-ink"
              }`}
            >
              {entry.label}
            </Link>
          ))}
        </div>

        {bookings.length === 0 ? (
          <EmptyState
            icon={<CalendarBlank size={24} weight="light" />}
            title={
              tab === "upcoming"
                ? "Nothing booked yet"
                : tab === "past"
                  ? "No completed bookings"
                  : "Nothing cancelled"
            }
            action={
              <Link
                href={customer?.postcode ? `/salons?near=${encodeURIComponent(customer.postcode)}` : "/salons"}
                className="inline-flex min-h-11 items-center rounded-full bg-metal px-6 text-sm font-bold text-metal-ink active:scale-[0.98]"
              >
                Find a pro
              </Link>
            }
          >
            {tab === "upcoming"
              ? "When you book someone, the appointment and its live status appear here."
              : "Bookings move into this tab once they are behind you."}
          </EmptyState>
        ) : (
          <div className="space-y-2">
            {bookings.map((booking) => (
              <Link
                key={booking.id}
                href={`/bookings/${booking.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-glam border border-line bg-surface p-3 shadow-card transition hover:border-accent-500"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <BookingTypeTag bookingType={booking.bookingType} size="sm" />
                    <LifecycleChip status={booking.status} />
                    <span className="text-sm font-semibold text-ink">
                      {formatCustomerDayTime(booking.appointmentStartAt)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-ink-muted">
                    {booking.items.map((item) => item.name).join(" + ")}
                    {booking.provider ? ` · ${booking.provider.name}` : " · awaiting vendor"}
                  </p>
                </div>
                <span data-numeric className="text-sm font-bold text-ink">
                  {formatMoney(booking.totalInvoicePriceMinor + booking.tipMinor - booking.discountMinor)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* --- Details ---------------------------------------------------------- */}
      <PushPrompt audience="CUSTOMER" />
      <MarketingEmails
        initiallySubscribed={
          !(await prisma.appUser.findUnique({ where: { id: user.appUserId }, select: { marketingOptOutAt: true } }))
            ?.marketingOptOutAt
        }
      />

      <section id="details" className="scroll-mt-24 grid gap-6 md:grid-cols-[minmax(0,1fr)_16rem]">
        <Card className="p-5">
          <SectionTitle>Your details</SectionTitle>
          <div className="mb-5">
            <PhotoPicker
              initial={customer?.avatarUrl ? { url: customer.avatarUrl, fileId: customer.avatarFileId } : null}
            />
          </div>
          <DetailsForm name={customer?.name ?? ""} phone={customer?.phone ?? ""} email={user.email} />
        </Card>
        <Card className="flex flex-col justify-between gap-4 p-5">
          <div>
            <p className="font-display font-semibold text-ink">Need a hand?</p>
            <p className="mt-1 text-sm text-ink-muted">
              Every booking has a 24-hour window to raise a problem after it&rsquo;s finished.
            </p>
          </div>
          <form action="/auth/sign-out" method="post">
            <button type="submit" className="text-sm font-semibold text-ink-muted hover:text-ink">
              Sign out
            </button>
          </form>
        </Card>
      </section>
    </div>
  );
}
