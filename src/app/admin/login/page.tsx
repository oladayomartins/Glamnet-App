import type { Metadata } from "next";
import { SignInScreen } from "@/app/sign-in/sign-in-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin sign-in",
  robots: { index: false, follow: false },
};

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  return <SignInScreen audience="admin" searchParams={searchParams} />;
}
