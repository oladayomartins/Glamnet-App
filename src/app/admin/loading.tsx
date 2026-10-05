import {
  LoadingScreen,
  PageHeadingSkeleton,
  StatsSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

/** A first visit to the admin console, arriving: heading, figures, then a list. */
export default function Loading() {
  return (
    <LoadingScreen
      label="Loading the admin console"
      pageWidth="wide"
      className="space-y-8"
    >
      <PageHeadingSkeleton />
      <StatsSkeleton count={3} />
      <TableSkeleton rows={8} />
    </LoadingScreen>
  );
}
