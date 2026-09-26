import { LoadingScreen, RowsSkeleton } from "@/components/skeletons";
import { Card, Skeleton } from "@/components/ui";

/** A vendor profile, arriving: the header, then what they do. */
export default function Loading() {
  return (
    <LoadingScreen label="Loading this vendor" className="space-y-6">
      <Card className="flex items-center gap-4 p-5">
        <Skeleton className="h-20 w-20 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-full max-w-[22rem]" />
        </div>
      </Card>

      <Skeleton className="h-5 w-40" />
      <RowsSkeleton rows={3} />
    </LoadingScreen>
  );
}
