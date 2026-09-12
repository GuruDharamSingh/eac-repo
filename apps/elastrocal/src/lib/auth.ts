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

/** The current signed-in viewer, or null. Never throws or redirects. */
export async function getViewer(): Promise<Viewer | null> {
  const session = await getServerSession();
  if (!session.user) return null;

  const userId = session.user.db_user_id ?? session.user.id;
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
