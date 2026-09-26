import { FormSkeleton, LoadingScreen, PageHeadingSkeleton } from "@/components/skeletons";

/** The booking flow, arriving. */
export default function Loading() {
  return (
    <LoadingScreen label="Loading the booking flow" className="space-y-6">
      <PageHeadingSkeleton />
      <FormSkeleton fields={3} />
    </LoadingScreen>
  );
}
