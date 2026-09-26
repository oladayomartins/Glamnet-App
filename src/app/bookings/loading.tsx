import { LoadingScreen, PageHeadingSkeleton } from "@/components/skeletons";
import { Card, Skeleton } from "@/components/ui";

/** A booking, arriving: its state, its detail, then its money. */
export default function Loading() {
  return (
    <LoadingScreen label="Loading this booking" className="space-y-6">
      <PageHeadingSkeleton />

      <Card className="space-y-3 p-5">
        <Skeleton className="h-7 w-36 rounded-full" />
        <Skeleton className="h-4 w-full max-w-[24rem]" />
        <Skeleton className="h-4 w-full max-w-[18rem]" />
      </Card>

      <Card className="space-y-2.5 p-5">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </Card>
    </LoadingScreen>
  );
}
