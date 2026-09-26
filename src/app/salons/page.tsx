import type { Metadata } from "next";
import { DirectoryView, type DirectoryQuery } from "./directory-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Beauty pros near you",
  description: "Verified independent hair, makeup, nails and wellness pros across the UK, sorted by distance from your postcode.",
  alternates: { canonical: "/salons" },
};

/** The UK-wide directory: /salons?near=M1 1AE&radius=10&hub=nails. */
export default async function SalonsPage({ searchParams }: { searchParams: Promise<DirectoryQuery> }) {
  return <DirectoryView city={null} basePath="/salons" query={await searchParams} />;
}
