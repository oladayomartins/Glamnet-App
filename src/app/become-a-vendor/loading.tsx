import { LoadingScreen, PageHeadingSkeleton, RowsSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingScreen label="Loading" className="space-y-6">
      <PageHeadingSkeleton />
      <RowsSkeleton rows={3} />
    </LoadingScreen>
  );
}
