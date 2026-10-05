import { redirect } from "next/navigation";
import { getServerSession } from "@elkdonis/auth-server";
import { getOrgRole, type OrgRole } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getGuestId } from "@/lib/guest";

/**
 * Access control.
 *
 * Charts are personal data, gated by who KEEPS them — a signed-in account or
 * a cookie-identified guest — never by org role.
 *
 * The org role gates the hub: any membership opens /hub, and `owner`/`guide`
 * may publish (services, profiles). There is deliberately no email allowlist
 * and no global users.is_admin check (that flag stays exclusive to apps/admin).
 */

export const EDITOR_ROLES: OrgRole[] = ["owner", "guide"];

export interface Viewer {
  /** Database user id — what astro_charts.owner_id holds. */
  userId: string;
  email: string;
  /** Role in THIS org, or null for a signed-in non-member. */
  role: OrgRole | null;
  /** owner or guide: may publish services and profiles. */
  canEdit: boolean;
  /** Any membership: may open the hub. */
  isMember: boolean;
}

/** Who a chart belongs to: an account, or a guest browser. */
export type Keeper = { kind: "user"; userId: string } | { kind: "guest"; guestId: string };

/**
 * Accounts that are one person inside EAC Astro (Justin, 2026-10-04): Guru
 * Dharam Singh and Justin Gillis review together, so in this app either login
 * acts as the shared account. Reviews, marks, decks, synced app records and
 * charts all resolve to it. Other EAC apps are unaffected (this mapping lives
 * only in elastrocal's getViewer). Rows written before the merge were moved
 * over; the backup table astro_account_merge_20261004 lists every moved row.
 */
const SHARED_ACCOUNT: Record<string, string> = {
  // gurudharamsingh@gmail.com -> justin.gillisb@gmail.com
  "1e1fcc82-8b63-4df0-90d2-59a4aa515906": "fbf699b9-c708-440a-9abd-40f8953978e5",
};

/** The current signed-in viewer, or null. Never throws or redirects. */
export async function getViewer(): Promise<Viewer | null> {
  const session = await getServerSession();
  if (!session.user) return null;

  const signedIn = session.user.db_user_id ?? session.user.id;
  const userId = SHARED_ACCOUNT[signedIn] ?? signedIn;
  const role = await getOrgRole(userId, siteConfig.orgId).catch(() => null);

  return {
    userId,
    email: session.user.email,
    role,
    canEdit: role !== null && EDITOR_ROLES.includes(role),
    isMember: role !== null,
  };
}

/**
 * The viewer, the guest cookie, and the keeper that reads should use.
 * A signed-in viewer wins; a guest cookie alongside it is the signal to claim
 * that guest's charts (see claimGuestCharts).
 */
export async function getIdentity(): Promise<{ viewer: Viewer | null; guestId: string | null; keeper: Keeper | null }> {
  const [viewer, guestId] = await Promise.all([getViewer(), getGuestId()]);
  const keeper: Keeper | null = viewer
    ? { kind: "user", userId: viewer.userId }
    : guestId
      ? { kind: "guest", guestId }
      : null;
  return { viewer, guestId, keeper };
}

/**
 * Gate for /hub pages: signed-out visitors go to login with a return path,
 * signed-in non-members to the home page — a wrong turn, not an attack.
 * redirect() applies basePath itself in this Next version (verified: wrapping
 * it in withBase() produced /astro/astro/login), so paths here stay bare.
 */
export async function requireOrgMember(returnTo = "/hub"): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (!viewer.isMember) redirect("/");
  return viewer;
}

/** Gate for publishing: owner or guide. Server actions re-check with this, never trust the page. */
export async function requireOrgEditor(returnTo = "/hub"): Promise<Viewer> {
  const viewer = await requireOrgMember(returnTo);
  if (!viewer.canEdit) redirect("/hub");
  return viewer;
}

/**
 * Gate for the review studio (/hub/studio): owners only. Grades and gold texts
 * become training data, so the graders are the app's owners (decision,
 * 2026-09-26; docs/open/ASTRO_STUDIO_BRIEF_2026-09-26.md).
 */
export async function requireStudioReviewer(returnTo = "/hub/studio"): Promise<Viewer> {
  const viewer = await requireOrgMember(returnTo);
  if (viewer.role !== "owner") redirect("/hub");
  return viewer;
}
