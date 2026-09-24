import { SignInScreen } from "./sign-in-page";

export const dynamic = "force-dynamic";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  return <SignInScreen audience="everyone" searchParams={searchParams} />;
}
