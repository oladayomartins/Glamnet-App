import {
  LoadingScreen,
  PageHeadingSkeleton,
  StatsSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

/** The admin dashboard, arriving: reporting, then the ledger. */
export default function Loading() {
  return (
    <LoadingScreen
      label="Loading the dashboard"
      pageWidth="wide"
      className="space-y-8"
    >
      <PageHeadingSkeleton />
      <StatsSkeleton count={3} />
      <TableSkeleton rows={8} />
    </LoadingScreen>
  );
}
