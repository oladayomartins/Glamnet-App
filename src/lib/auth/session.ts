import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { createSupabaseServerClient } from "./supabase-server";

export type Role = "CUSTOMER" | "PROVIDER" | "ADMIN";

export interface SessionUser {
  appUserId: string;
  authUserId: string;
  email: string;
  role: Role;
  customerId: string | null;
  providerId: string | null;
  /** Providers only: whether an admin has approved them yet. */
  providerApproved: boolean;
}

/**
 * Emails allowed to hold ADMIN, from the environment.
 *
 * Deliberately not a database flag a request could set: the role is granted
 * from server configuration on first sign-in, so no signup flow, API payload
 * or compromised client can escalate itself to admin.
 */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * The signed-in user, or null.
 *
 * Always uses `getUser()`, never `getSession()`: getUser revalidates the token
 * with Supabase, while a session read trusts a cookie the browser could have
 * tampered with. Authorisation must not rest on an unverified cookie.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  const email = user.email.toLowerCase();
  const shouldBeAdmin = adminEmails().includes(email);

  // First sign-in creates the profile. The role comes from server config,
  // never from anything the client supplied.
  const appUser = await prisma.appUser.upsert({
    where: { authUserId: user.id },
    create: {
      authUserId: user.id,
      email,
      role: shouldBeAdmin ? "ADMIN" : "CUSTOMER",
    },
    // Keep the admin allowlist authoritative on every sign-in, so revoking an
    // email in configuration actually removes the role.
    update: shouldBeAdmin ? { role: "ADMIN", email } : { email },
    include: { customer: true, provider: true },
  });

  return {
    appUserId: appUser.id,
    authUserId: appUser.authUserId,
    email: appUser.email,
    role: appUser.role as Role,
    customerId: appUser.customer?.id ?? null,
    providerId: appUser.provider?.id ?? null,
    providerApproved: appUser.provider?.approvalStatus === "APPROVED",
  };
}

/** Require a signed-in user, or bounce to sign-in with a return path. */
export async function requireUser(returnTo: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/** Require a specific role. A wrong role is a 404, not a redirect loop. */
export async function requireRole(
  role: Role,
  returnTo: string,
): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (user.role !== role) redirect("/forbidden");
  return user;
}

/** Require an approved provider — pending signups get the waiting screen. */
export async function requireApprovedProvider(
  returnTo: string,
): Promise<SessionUser> {
  const user = await requireRole("PROVIDER", returnTo);
  if (!user.providerApproved) redirect("/provider/pending");
  return user;
}
