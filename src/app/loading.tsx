import {
  HeroSkeleton,
  LoadingScreen,
  RailSkeleton,
} from "@/components/skeletons";

/**
 * The marketplace home, arriving.
 *
 * This file is also the fallback for any route below it without its own
 * `loading.tsx`, which is why every sibling route has one — the home page is
 * a full-bleed hero and nothing else in the product looks like it.
 */
export default function Loading() {
  return (
    <LoadingScreen
      label="Loading the marketplace"
      pageWidth="full"
      className="-mt-6 pb-6"
    >
      <HeroSkeleton />

      <div className="mx-auto w-full max-w-[var(--glam-page-max)] px-4">
        <RailSkeleton cards={4} />
        <RailSkeleton cards={4} aspect="aspect-[3/4]" />
      </div>
    </LoadingScreen>
  );
}
