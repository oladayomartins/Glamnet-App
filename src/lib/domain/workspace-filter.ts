/**
 * The directory's "where does it happen" filter: the kind of space a client
 * visits, or a pro who comes to them. One choice at a time, carried in the
 * URL as ?space=<slug> so a filtered search can be shared.
 *
 * "Comes to you" is not a workspace type: it matches mobile-only pros and pros
 * with a workspace who also travel, because a client asking for a home visit
 * does not care which of the two they get.
 */
export interface WorkspaceFilter {
  slug: string;
  label: string;
  /** The Provider.workspaceType it matches, or null for "comes to you". */
  workspaceType: "HOME_SALON" | "PRIVATE_ROOM" | "CHAIR" | null;
}

export const WORKSPACE_FILTERS: readonly WorkspaceFilter[] = [
  { slug: "home-salon", label: "Home salon", workspaceType: "HOME_SALON" },
  { slug: "private-room", label: "Private room", workspaceType: "PRIVATE_ROOM" },
  { slug: "chair", label: "Independent chair", workspaceType: "CHAIR" },
  { slug: "comes-to-you", label: "Comes to you", workspaceType: null },
];

/** The filter a ?space= value names, or null for anything unknown or empty. */
export function parseWorkspaceFilter(value: string | null | undefined): WorkspaceFilter | null {
  const wanted = (value ?? "").trim().toLowerCase();
  return WORKSPACE_FILTERS.find((filter) => filter.slug === wanted) ?? null;
}

/**
 * The Provider `where` clause for a filter. Plain data rather than a Prisma
 * type, so the rule is unit-testable and defined only here.
 */
export function workspaceWhere(filter: WorkspaceFilter) {
  return filter.workspaceType
    ? { workspaceType: filter.workspaceType }
    : { OR: [{ workspaceType: "MOBILE" }, { travelsToClients: true }] };
}
