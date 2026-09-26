import {
  LoadingScreen,
  PageHeadingSkeleton,
  RowsSkeleton,
} from "@/components/skeletons";
import { Card, Skeleton } from "@/components/ui";

/** Offers, arriving. The filter bar first, because it is what moves. */
export default function Loading() {
  return (
    <LoadingScreen
      label="Finding vendors"
      pageWidth="wide"
      className="space-y-6"
    >
      <PageHeadingSkeleton />

      <Card className="flex flex-wrap items-center gap-3 p-3">
        <Skeleton className="h-11 flex-1 rounded-glam-input" />
        <Skeleton className="h-11 w-40 rounded-glam-input" />
        <Skeleton className="h-11 w-28 rounded-full" />
      </Card>

      <RowsSkeleton rows={4} />
    </LoadingScreen>
  );
}
