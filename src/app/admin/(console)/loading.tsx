import { LoadingScreen, PageHeadingSkeleton, TableSkeleton } from "@/components/skeletons";

/**
 * Any console section, arriving.
 *
 * Sits inside the console layout, so a click on the rail swaps the page for
 * this straight away while the rail stays put. Without it the nearest boundary
 * was above the layout, which does not re-render on a client navigation: the
 * old page stayed frozen on screen until the new one had finished every query.
 * It is also where a default `<Link>` prefetch stops, which keeps the rail's
 * prefetches to the shell instead of a full render of every section.
 */
export default function Loading() {
  return (
    <LoadingScreen label="Loading" className="space-y-6">
      <PageHeadingSkeleton />
      <TableSkeleton rows={8} />
    </LoadingScreen>
  );
}
