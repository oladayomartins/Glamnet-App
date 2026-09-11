import Link from "next/link";
import {
  CalendarCheck,
  House,
  Lightning,
  MagnifyingGlass,
  ShieldCheck,
  Star,
} from "@phosphor-icons/react/dist/ssr";
import { getPricingContext } from "@/lib/server/emergency-config";
import { getMarketingData } from "@/lib/server/marketing";
import { Card } from "@/components/ui";
import { SearchBar } from "@/components/search-bar";
import { GlamImage } from "@/components/glam-image";
import { describeSurcharge, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

const HOW_IT_WORKS = [
  {
    icon: <MagnifyingGlass size={20} weight="bold" />,
    title: "Search",
    body: "Tell us what you need and where. You only see services someone can actually deliver near you.",
  },
  {
    icon: <CalendarCheck size={20} weight="bold" />,
    title: "Compare & book",
    body: "Real availability and the full itemised price, before you authorise anything.",
  },
  {
    icon: <House size={20} weight="bold" />,
    title: "They come to you",
    body: "The first matched professional to accept takes the job, and the slot locks into their calendar.",
  },
];

export default async function MarketingPage() {
  const [{ providers, categories, cities, stats }, { config, thresholdMinutes }] =
    await Promise.all([getMarketingData(), getPricingContext()]);

  const thresholdHours = Math.round(thresholdMinutes / 60);
  const areas = cities.map((city) => ({
    id: city.hubId,
    name: city.city,
    city: city.city,
    sector: city.sector,
  }));

  return (
    <div className="space-y-16 pb-4">
      {/* ---- Hero + search ------------------------------------------- */}
      <section className="pt-4">
        <h1 className="max-w-2xl font-display text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-ink sm:text-5xl">
          Hair and makeup,
          <br />
          at your door.
        </h1>
        <p className="mt-4 max-w-xl text-base text-ink-muted">
          Book a vetted beauty professional to come to you — today if you need
          one. Real availability, a price you see before you pay.
        </p>

        <div className="mt-6 max-w-2xl">
          <SearchBar areas={areas} />
        </div>
      </section>

      {/* ---- Trust figures. Real counts, never rounded up. ------------ */}
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          {
            value: String(stats.providerCount),
            label: stats.providerCount === 1 ? "Vetted professional" : "Vetted professionals",
          },
          {
            value: stats.averageRating ? `${stats.averageRating.toFixed(1)}/5` : "—",
            label: "Average rating",
          },
          {
            value: String(stats.serviceCount),
            label: `Services across ${stats.cityCount} ${stats.cityCount === 1 ? "area" : "areas"}`,
          },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <p className="font-display text-3xl font-bold tabular-nums text-ink">
              {stat.value}
            </p>
            <p className="mt-0.5 text-sm text-ink-muted">{stat.label}</p>
          </Card>
        ))}
      </section>

      {/* ---- Categories ---------------------------------------------- */}
      {categories.length > 0 ? (
        <section>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-ink">
              Browse by service
            </h2>
            <Link href="/search" className="text-sm font-semibold text-brand-700 hover:underline">
              See all
            </Link>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {categories.map((category) => (
              <Link
                key={category.name}
                href={`/search?q=${encodeURIComponent(category.name)}`}
                className="group overflow-hidden rounded-glam border border-line bg-surface shadow-card transition hover:-translate-y-0.5 hover:shadow-raised"
              >
                {/* GlamImage falls back to the brand metal when a category
                    has no photography yet, so the tile never looks broken. */}
                <GlamImage
                  src={category.imageUrl}
                  alt=""
                  width={400}
                  height={200}
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="h-24 w-full object-cover"
                />
                <div className="p-4">
                  <h3 className="font-display text-lg font-semibold text-ink">
                    {category.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {category.count}{" "}
                    {category.count === 1 ? "service" : "services"} · from{" "}
                    {formatMoney(category.fromMinor)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---- Featured professionals ---------------------------------- */}
      {providers.length > 0 ? (
        <section>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-ink">
              Professionals near you
            </h2>
            <Link href="/search" className="text-sm font-semibold text-brand-700 hover:underline">
              See all
            </Link>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {providers.slice(0, 6).map((provider) => (
              <Link
                key={provider.id}
                href={`/book/${provider.hubId}`}
                className="rounded-glam border border-line bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-raised"
              >
                <div className="flex items-start gap-3">
                  <GlamImage
                    src={provider.avatarUrl}
                    alt=""
                    width={96}
                    height={96}
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-base font-semibold text-ink">
                      {provider.name}
                    </h3>
                    <p className="font-mono text-xs text-ink-muted">
                      {provider.city} · {provider.sector}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 font-mono text-sm text-ink">
                    <Star size={13} weight="fill" className="text-accent-500" />
                    {provider.rating.toFixed(1)}
                  </span>
                </div>
                {provider.bio ? (
                  <p className="mt-2 line-clamp-2 text-sm text-ink-muted">
                    {provider.bio}
                  </p>
                ) : null}
                {provider.specialities.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {provider.specialities.slice(0, 3).map((speciality) => (
                      <span
                        key={speciality}
                        className="rounded-full bg-sunken px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted"
                      >
                        {speciality}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---- Areas ---------------------------------------------------- */}
      {cities.length > 0 ? (
        <section>
          <h2 className="font-display text-xl font-semibold text-ink">
            Browse by area
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cities.map((city) => (
              <Link
                key={city.city}
                href={`/search?location=${encodeURIComponent(city.city)}`}
                className="rounded-glam border border-line bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-raised"
              >
                <h3 className="font-display text-lg font-semibold text-ink">
                  {city.city}
                </h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {city.providerCount}{" "}
                  {city.providerCount === 1 ? "professional" : "professionals"}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---- How it works -------------------------------------------- */}
      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-ink">
            How it works
          </h2>
          <Link href="/how-it-works" className="text-sm font-semibold text-brand-700 hover:underline">
            In detail
          </Link>
        </div>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          {HOW_IT_WORKS.map((step, index) => (
            <li key={step.title}>
              <Card className="h-full p-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                    {step.icon}
                  </span>
                  <span className="font-mono text-xs text-ink-muted">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-2.5 font-display text-base font-semibold text-ink">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm text-ink-muted">{step.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* ---- Emergency: the thing that makes this different ----------- */}
      <section>
        <Card className="border-l-4 border-l-emergency p-5">
          <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-emergency-ink">
            <Lightning size={16} weight="bold" />
            Need someone today?
          </p>
          <h2 className="mt-2 font-display text-xl font-semibold text-ink">
            Emergency bookings, within {thresholdHours} hours
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Book an appointment starting in the next {thresholdHours} hours and
            we broadcast it to the professionals near you who are free right
            now.
            {config
              ? ` Short notice carries a ${describeSurcharge(config.surchargeType, config.surchargeValue)} rate —`
              : " Short notice carries a higher rate —"}{" "}
            shown in full before you authorise payment, never after.
          </p>
          <Link
            href="/book"
            className="mt-4 inline-flex rounded-glam-sm bg-emergency px-4 py-2.5 text-sm font-semibold text-on-emergency"
          >
            Find someone now
          </Link>
        </Card>
      </section>

      {/* ---- Dual CTA -------------------------------------------------- */}
      <section>
        <Card className="p-6 text-center">
          <h2 className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">
            Ready when you are
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-ink-muted">
            Whether you need someone this evening or you want to take bookings
            of your own.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link
              href="/search"
              className="rounded-glam-sm bg-brand-700 px-5 py-2.5 text-sm font-semibold text-on-brand"
            >
              Find a professional
            </Link>
            <Link
              href="/sign-up"
              className="rounded-glam-sm bg-surface px-5 py-2.5 text-sm font-semibold text-ink ring-1 ring-line"
            >
              Become a provider
            </Link>
          </div>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-ink-muted">
            <ShieldCheck size={14} weight="bold" />
            Every professional is reviewed before taking work
          </p>
        </Card>
      </section>
    </div>
  );
}
