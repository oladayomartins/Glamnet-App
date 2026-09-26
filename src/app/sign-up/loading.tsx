import { FormSkeleton, LoadingScreen, PageHeadingSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingScreen label="Loading" className="space-y-6">
      <PageHeadingSkeleton />
      <FormSkeleton fields={2} />
    </LoadingScreen>
  );
}
