import { redirect } from "next/navigation";
import { getServerSession } from "@elkdonis/auth-server";
import { getOrgRole, type OrgRole } from "@elkdonis/services";
import { siteConfig } from "@/config/site";

/**
 * Access control for the site.
 *
 * One rule, one place: a person can edit this site if they hold `owner` or
 * `guide` in `user_organizations` for this org. There is no email allowlist
 * (the pre-rebuild version had one hardcoded in three files) and no reference
 * to the global `users.is_admin` superadmin flag, which stays exclusive to
 * apps/admin by design.
 */

export const EDITOR_ROLES: OrgRole[] = ["owner", "guide"];

export interface Viewer {
  /** Database user id — what threads.author_id and thread_rsvps.user_id hold. */
  userId: string;
  email: string;
  /** Role in THIS org, or null for a signed-in non-member. */
  role: OrgRole | null;
  /** owner or guide: may publish content and manage the site. */
  canEdit: boolean;
  /**
   * member or above: the hub, attendee lists, private media, chat.
   * A `viewer` (a follower, in the UI) is NOT a member — see
   * CENTER_PAGE_BRIEF_2026-09-09.md, decision 2.
   */
  isMember: boolean;
  /**
   * Any row in user_organizations for this org, viewer included. What
   * ORGANIZATION-visibility threads and /center key on (decision 6).
   */
  isAffiliate: boolean;
}

const MEMBER_ROLES: OrgRole[] = ["owner", "guide", "member"];

/**
 * The current viewer, or null when signed out. Never throws or redirects —
 * public pages call this to decide what to show, not whether to render.
 */
export async function getViewer(): Promise<Viewer | null> {
  const session = await getServerSession();
  if (!session.user) return null;

  const userId = session.user.db_user_id ?? session.user.id;
  const role = await getOrgRole(userId, siteConfig.orgId);

  return {
    userId,
    email: session.user.email,
    role,
    canEdit: role !== null && EDITOR_ROLES.includes(role),
    isMember: role !== null && MEMBER_ROLES.includes(role),
    isAffiliate: role !== null,
  };
}

/**
 * Gate for /manage pages. Sends signed-out visitors to login with a return
 * path, and signed-in non-editors to the home page — deliberately not a 403,
 * since a member landing on an editorial URL is a wrong turn, not an attack.
 */
export async function requireOrgEditor(returnTo = "/manage"): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (!viewer.canEdit) redirect("/");
  return viewer;
}

/** Route-handler equivalent of requireOrgEditor — returns null instead of redirecting. */
export async function getApiEditor(): Promise<Viewer | null> {
  const viewer = await getViewer();
  return viewer?.canEdit ? viewer : null;
}

/**
 * Gate for /hub and other member-only pages — any role counts, not just
 * owner/guide. Same redirect shape as requireOrgEditor (signed-out → login
 * with a return path, signed-in non-member → home).
 */
export async function requireOrgMember(returnTo = "/hub"): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (!viewer.isMember) redirect("/");
  return viewer;
}

/** Route-handler equivalent of requireOrgMember — returns null instead of redirecting. */
export async function getApiMember(): Promise<Viewer | null> {
  const viewer = await getViewer();
  return viewer?.isMember ? viewer : null;
}
