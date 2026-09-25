import { cache } from "react";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { createSupabaseServerClient } from "./supabase-server";
import { hubForPlace, lookupPostcode } from "@/lib/server/geo";

export type Role = "CUSTOMER" | "PROVIDER" | "ADMIN";

export interface SessionUser {
  appUserId: string;
  authUserId: string;
  email: string;
  /** What to call them in the header: vendor or customer name, else the email's first part. */
  name: string;
  /** Profile photo, or "" to show initials. */
  avatarUrl: string;
  role: Role;
  customerId: string | null;
  providerId: string | null;
  /** Vendors only: whether an admin has approved them yet. */
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
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const account = await loadAccount();
  // A suspended account is treated as signed out everywhere; the places that
  // need to explain why ask isSessionSuspended().
  return account && !account.suspended ? account.user : null;
});

/** Whether the browser holds a valid login for an account an admin suspended. */
export async function isSessionSuspended(): Promise<boolean> {
  return (await loadAccount())?.suspended ?? false;
}

const loadAccount = cache(
  async (): Promise<{ user: SessionUser; suspended: boolean } | null> => {
    const loaded = await loadSessionUser();
    if (!loaded) return null;
    const { suspendedAt, ...user } = loaded;
    // Admins come from the allowlist and cannot be locked out from the console.
    return { user, suspended: user.role !== "ADMIN" && suspendedAt !== null };
  },
);

/**
 * The work behind {@link getSessionUser}.
 *
 * Wrapped in React's `cache` above so the header, the page and anything else
 * rendering in one request share a single lookup. Before that, a new user's
 * first page load ran this twice at once, both found no account, both tried
 * to create one, and the loser crashed the page with a unique-constraint
 * error.
 */
async function loadSessionUser(): Promise<(SessionUser & { suspendedAt: Date | null }) | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  const email = user.email.toLowerCase();
  const shouldBeAdmin = adminEmails().includes(email);

  // Sign-up intent arrives in Supabase user_metadata, which the user can edit
  // themselves — so it is treated as a request, not a fact. Only CUSTOMER and
  // PROVIDER are honoured; ADMIN can never come from here. Self-declaring
  // PROVIDER grants nothing on its own, because a new vendor is PENDING and
  // the matching query only broadcasts to APPROVED ones.
  const requested = String(user.user_metadata?.role ?? "").toUpperCase();
  const requestedRole: Role = requested === "PROVIDER" ? "PROVIDER" : "CUSTOMER";
  const displayName =
    String(user.user_metadata?.name ?? "").trim() || email.split("@")[0];

  const existing = await prisma.appUser.findUnique({
    where: { authUserId: user.id },
    include: { customer: true, provider: true },
  });

  let appUser = existing;

  // A new vendor's area comes from the postcode they signed up with, anywhere
  // in the UK. Looked up before the transaction: a network call must not hold
  // a database transaction open.
  const signupPostcode = String(user.user_metadata?.postcode ?? "");
  const signupPlace =
    !existing && !shouldBeAdmin && requestedRole === "PROVIDER" && signupPostcode
      ? await lookupPostcode(signupPostcode)
      : null;
  const signupHub = signupPlace ? await hubForPlace(signupPlace) : null;

  const createAppUser = () =>
    prisma.$transaction(async (tx) => {
      const created = await tx.appUser.create({
        data: {
          authUserId: user.id,
          email,
          role: shouldBeAdmin ? "ADMIN" : requestedRole,
        },
      });

      if (!shouldBeAdmin && requestedRole === "PROVIDER") {
        const hubId = String(user.user_metadata?.hubId ?? "");
        const hub =
          signupHub ??
          (hubId ? await tx.hub.findUnique({ where: { id: hubId } }) : null) ??
          (await tx.hub.findFirst({ orderBy: { name: "asc" } }));

        if (hub) {
          await tx.provider.create({
            data: {
              name: displayName,
              email,
              hubId: hub.id,
              appUserId: created.id,
              ...(signupPlace
                ? {
                    basePostcode: signupPlace.postcode ?? "",
                    workspaceSector: signupPlace.outcode,
                    latitude: signupPlace.lat,
                    longitude: signupPlace.lng,
                  }
                : {}),
              // Never APPROVED on creation: vetting is the point.
              approvalStatus: "PENDING",
              isAcceptingWork: false,
              rating: 5,
              completedBookings: 0,
            },
          });
        }
      } else if (!shouldBeAdmin) {
        // An existing seeded customer with this email adopts the new login
        // rather than being duplicated.
        const claimed = await tx.customer.findUnique({ where: { email } });
        if (claimed && claimed.appUserId === null) {
          await tx.customer.update({
            where: { id: claimed.id },
            data: { appUserId: created.id },
          });
        } else if (!claimed) {
          await tx.customer.create({
            data: { name: displayName, email, appUserId: created.id },
          });
        }
      }

      return tx.appUser.findUniqueOrThrow({
        where: { id: created.id },
        include: { customer: true, provider: true },
      });
    });

  if (!appUser) {
    // First sign-in: create the login and the matching profile together, so a
    // signed-in user always has somewhere to hang bookings or work.
    appUser = await createAppUser().catch(async (error: unknown) => {
      // Two requests for the same brand-new user (two tabs, or a prefetch
      // beside the page) can still race past the lookup above. The loser's
      // insert hits the unique key on authUserId — the account exists now, so
      // read the one the winner made instead of failing the page.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const created = await prisma.appUser.findUnique({
          where: { authUserId: user.id },
          include: { customer: true, provider: true },
        });
        if (created) return created;
        // The email is taken by an older login: the person's Supabase account
        // was deleted and they signed up again. Supabase has verified they
        // own this address, so the new login takes over the old profile —
        // bookings, storefront and all — instead of the page crashing.
        const previous = await prisma.appUser.findUnique({ where: { email } });
        if (previous) {
          return prisma.appUser.update({
            where: { id: previous.id },
            data: { authUserId: user.id },
            include: { customer: true, provider: true },
          });
        }
      }
      throw error;
    });
  } else if (shouldBeAdmin && appUser.role !== "ADMIN") {
    // Keep the allowlist authoritative: adding an email promotes on next
    // sign-in, and removing it demotes.
    appUser = await prisma.appUser.update({
      where: { id: appUser.id },
      data: { role: "ADMIN" },
      include: { customer: true, provider: true },
    });
  } else if (!shouldBeAdmin && appUser.role === "ADMIN") {
    appUser = await prisma.appUser.update({
      where: { id: appUser.id },
      data: { role: "CUSTOMER" },
      include: { customer: true, provider: true },
    });
  }

  return {
    appUserId: appUser.id,
    authUserId: appUser.authUserId,
    email: appUser.email,
    name:
      appUser.provider?.name.trim() ||
      appUser.customer?.name.trim() ||
      String(user.user_metadata?.name ?? "").trim() ||
      appUser.email.split("@")[0],
    avatarUrl: appUser.provider?.avatarUrl || appUser.customer?.avatarUrl || "",
    role: appUser.role as Role,
    customerId: appUser.customer?.id ?? null,
    providerId: appUser.provider?.id ?? null,
    providerApproved: appUser.provider?.approvalStatus === "APPROVED",
    suspendedAt: appUser.suspendedAt,
  };
}

/** Require a signed-in user, or bounce to sign-in with a return path. */
export async function requireUser(returnTo: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user && (await isSessionSuspended())) redirect("/suspended");
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/** Require a specific role. A wrong role is a 404, not a redirect loop. */
export async function requireRole(
  role: Role,
  returnTo: string,
): Promise<SessionUser> {
  // Staff pages send a signed-out visitor to the staff door.
  if (role === "ADMIN" && !(await getSessionUser()) && !(await isSessionSuspended())) {
    redirect(`/admin/login?next=${encodeURIComponent(returnTo)}`);
  }
  const user = await requireUser(returnTo);
  if (user.role !== role) redirect("/forbidden");
  return user;
}

/** Require an approved vendor — pending signups get the waiting screen. */
export async function requireApprovedProvider(
  returnTo: string,
): Promise<SessionUser> {
  const user = await requireRole("PROVIDER", returnTo);
  if (!user.providerApproved) redirect("/provider/pending");
  return user;
}
