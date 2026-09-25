import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { citySlug } from "@/lib/domain/postcode";
import { listCities } from "@/lib/server/cities";
import { DirectoryView, type DirectoryQuery } from "../../salons/directory-view";

export const dynamic = "force-dynamic";

type Params = Promise<{ city: string }>;

/**
 * The city as it is stored on the Hub, or a city admins have listed on the
 * home page (which may have nobody yet), or null for anywhere else.
 */
async function resolveCity(slug: string): Promise<string | null> {
  const wanted = slug.toLowerCase();
  const launch = (await listCities()).find((city) => citySlug(city.name) === wanted);
  if (launch) return launch.name;
  const cities = await prisma.hub.findMany({ distinct: ["city"], select: { city: true } });
  return cities.find((hub) => citySlug(hub.city) === wanted)?.city ?? null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { city: slug } = await params;
  const city = await resolveCity(slug);
  return city
    ? {
        title: `Beauty salons in ${city}`,
        description: `Home salons, private rooms and independent chairs across ${city}, sorted by postcode.`,
      }
    : { title: "Not found" };
}

/** One city's directory: the UK-wide view, narrowed to /sheffield, /london… */
export default async function DirectoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<DirectoryQuery>;
}) {
  const [{ city: citySlug }, query] = await Promise.all([params, searchParams]);
  const city = await resolveCity(citySlug);
  if (!city) notFound();
  return <DirectoryView city={city} basePath={`/${citySlug}/salons`} query={query} />;
}
