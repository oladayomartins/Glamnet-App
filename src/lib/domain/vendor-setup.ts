/**
 * How far a vendor is through setting up, as a checklist and a percentage.
 *
 * Three levels:
 *   - Listed: the bookable basics are done (`LISTING_ITEMS`). The vendor is in
 *     the directory and takes storefront bookings, shown as "Not verified".
 *   - 100%: every item, including an admin's approval, is done.
 *   - Verified: an admin has approved them, which they can only do once
 *     every other item is done. Verified vendors get the badge, urgent
 *     requests and their payouts; until then their earnings are held.
 *
 * Every item carries an equal share of the percentage.
 */

export type SetupItemKey =
  | "photo"
  | "name"
  | "menu"
  | "link"
  | "bio"
  | "workspace"
  | "hours"
  | "lookbook"
  | "document"
  | "bank"
  | "approval";

/** The wizard step that finishes each item, for "Finish" shortcuts. */
export const SETUP_STEP: Record<SetupItemKey, string> = {
  photo: "profile",
  name: "profile",
  menu: "menu",
  link: "storefront",
  bio: "storefront",
  workspace: "workspace",
  hours: "hours",
  lookbook: "lookbook",
  document: "compliance",
  bank: "payouts",
  approval: "review",
};

export const SETUP_LABEL: Record<SetupItemKey, string> = {
  photo: "Profile photo",
  name: "Your name or business name",
  menu: "At least one service on your menu",
  link: "Storefront link",
  bio: "A short bio (20 characters or more)",
  workspace: "Where you work",
  hours: "Working hours",
  lookbook: "At least one lookbook photo",
  document: "ID, insurance, licence or certificate",
  bank: "Bank linked for payouts",
  approval: "Checked and approved by GLAMNET",
};

/** What a vendor needs before they are listed and bookable. */
export const LISTING_ITEMS: readonly SetupItemKey[] = ["name", "menu", "link", "workspace", "hours"];

const ORDER: readonly SetupItemKey[] = [
  "name",
  "menu",
  "link",
  "workspace",
  "hours",
  "photo",
  "bio",
  "lookbook",
  "document",
  "bank",
  "approval",
];

export interface SetupFacts {
  name: string;
  avatarUrl: string;
  slug: string | null;
  bio: string;
  workspaceType: string;
  workspaceSector: string;
  workspaceAddress: string;
  serviceCount: number;
  availabilityCount: number;
  lookbookCount: number;
  /** Documents on file that haven't been rejected. */
  documentCount: number;
  payoutsEnabled: boolean;
  approvalStatus: string;
}

export interface SetupItem {
  key: SetupItemKey;
  label: string;
  done: boolean;
  /** Needed to be listed, not only to be verified. */
  requiredToList: boolean;
  step: string;
}

export interface SetupProgress {
  items: SetupItem[];
  /** 0–100, whole numbers. 100 only once approved. */
  percent: number;
  /** The bookable basics are done. */
  listable: boolean;
  /** Everything but the admin's approval is done: ready to be approved. */
  readyForApproval: boolean;
  verified: boolean;
}

export function setupProgress(facts: SetupFacts): SetupProgress {
  const done: Record<SetupItemKey, boolean> = {
    name: facts.name.trim().length >= 2,
    menu: facts.serviceCount > 0,
    link: Boolean(facts.slug),
    workspace:
      facts.workspaceSector.trim() !== "" &&
      (facts.workspaceType === "MOBILE" || facts.workspaceAddress.trim() !== ""),
    hours: facts.availabilityCount > 0,
    photo: facts.avatarUrl.trim() !== "",
    bio: facts.bio.trim().length >= 20,
    lookbook: facts.lookbookCount > 0,
    document: facts.documentCount > 0,
    bank: facts.payoutsEnabled,
    approval: facts.approvalStatus === "APPROVED",
  };
  const items = ORDER.map((key) => ({
    key,
    label: SETUP_LABEL[key],
    done: done[key],
    requiredToList: LISTING_ITEMS.includes(key),
    step: SETUP_STEP[key],
  }));
  const finished = items.filter((item) => item.done).length;
  return {
    items,
    // Floor, so 10 of 11 reads 90%, never a rounded-up 100% before approval.
    percent: Math.floor((finished / items.length) * 100),
    listable: LISTING_ITEMS.every((key) => done[key]),
    readyForApproval: items.every((item) => item.key === "approval" || item.done),
    verified: done.approval,
  };
}

/**
 * The Prisma filter for vendors who are listed: they have gone live with the
 * basics and haven't been rejected or suspended. Verified or not — the badge
 * tells clients which.
 */
export const LISTED_VENDOR: { approvalStatus: { in: string[] }; onboardedAt: { not: null } } = {
  approvalStatus: { in: ["PENDING", "APPROVED"] },
  onboardedAt: { not: null },
};
