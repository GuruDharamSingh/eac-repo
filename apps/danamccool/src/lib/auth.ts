import { redirect } from "next/navigation";
import { getServerSession, isAdmin } from "@elkdonis/auth-server";
import { getOrgRole, type OrgRole } from "@elkdonis/services";
import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";

/**
 * Access control for the site, following amrit-canada's src/lib/auth.ts.
 *
 * One rule: a person can edit this site if they hold `owner` or `guide` in
 * `user_organizations` for org `danamccool` (migration 125 seeds Dana as
 * `owner`). No email allowlist — the blog-scaffold version this replaced
 * checked `blogConfig.ownerEmails` instead of a real membership row.
 */

export const EDITOR_ROLES: OrgRole[] = ["owner", "guide"];

export interface Viewer {
  /** Database user id — what user_galleries.user_id holds. */
  userId: string;
  email: string;
  role: OrgRole | null;
  canEdit: boolean;
}

/** The current viewer, or null when signed out. Never throws or redirects. */
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
  };
}

/**
 * Who gets past the site-wide "in progress" wall (siteConfig.comingSoon):
 * the org's owner, or a platform admin ("dev"). Deliberately narrower than
 * `canEdit` — a `guide` can edit content but shouldn't be treated as
 * production-ready to show the still-unfinished public site.
 */
export async function canBypassComingSoon(viewer: Viewer | null): Promise<boolean> {
  if (!viewer) return false;
  if (viewer.role === "owner") return true;
  return isAdmin(viewer.userId).catch(() => false);
}

/** Gate for editing routes/actions. Redirects signed-out visitors to login. */
export async function requireOrgEditor(returnTo = "/"): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (!viewer.canEdit) redirect("/");
  return viewer;
}

/**
 * The site's single artist account, independent of who (if anyone) is
 * currently signed in — public pages need Dana's userId to read her public
 * galleries even when the visitor is anonymous.
 *
 * Resolves via the real `owner` membership row migration 125 creates, with
 * an email lookup as a fallback for a differently-shaped membership.
 */
let cachedOwnerId: string | null | undefined;

export async function getSiteOwnerUserId(): Promise<string | null> {
  if (cachedOwnerId !== undefined) return cachedOwnerId;
  try {
    const [byRole] = await db<Array<{ user_id: string }>>`
      SELECT user_id FROM user_organizations
      WHERE org_id = ${siteConfig.orgId} AND role = 'owner'
      LIMIT 1
    `;
    if (byRole?.user_id) {
      cachedOwnerId = byRole.user_id;
      return cachedOwnerId;
    }
    const [byEmail] = await db<Array<{ id: string }>>`
      SELECT id FROM users WHERE lower(email) = lower(${siteConfig.ownerEmail}) LIMIT 1
    `;
    cachedOwnerId = byEmail?.id ?? null;
  } catch (err) {
    console.error("[danamccool] getSiteOwnerUserId:", err);
    cachedOwnerId = null;
  }
  return cachedOwnerId;
}
