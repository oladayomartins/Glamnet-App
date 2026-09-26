import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";

/**
 * Who may open a vendor's app pages: that vendor, once approved, and admins.
 * They show earnings, customer names and addresses.
 */
export async function requireVendorPage(providerId: string, path: string) {
  const viewer = await requireUser(path);
  if (viewer.role !== "ADMIN" && viewer.providerId !== providerId) redirect("/forbidden");
  if (viewer.role === "PROVIDER" && !viewer.providerApproved) redirect("/provider/pending");
  return viewer;
}
