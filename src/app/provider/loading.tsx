import {
  LoadingScreen,
  PageHeadingSkeleton,
  RowsSkeleton,
  StatsSkeleton,
} from "@/components/skeletons";

/** The vendor dashboard, arriving: today's figures, then the requests. */
export default function Loading() {
  return (
    <LoadingScreen label="Loading your day" className="space-y-6">
      <PageHeadingSkeleton />
      <StatsSkeleton count={3} />
      <RowsSkeleton rows={3} />
    </LoadingScreen>
  );
}
