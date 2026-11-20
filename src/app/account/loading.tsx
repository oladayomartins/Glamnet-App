import { PageLoader } from "@/components/page-loader";

/** Shown while this page loads: a spinner, so the tap visibly worked. */
export default function Loading() {
  return <PageLoader label="Loading your account" />;
}
