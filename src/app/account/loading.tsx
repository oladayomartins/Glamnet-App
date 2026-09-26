import { LoadingScreen, PageHeadingSkeleton, RowsSkeleton } from "@/components/skeletons";

/** An account, arriving: who you are, then what you have booked. */
export default function Loading() {
  return (
    <LoadingScreen label="Loading your account" className="space-y-6">
      <PageHeadingSkeleton />
      <RowsSkeleton rows={3} />
    </LoadingScreen>
  );
}
