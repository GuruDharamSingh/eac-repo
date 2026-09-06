import { redirect } from "next/navigation";
import { getServerSession } from "@elkdonis/auth-server";
import { getOrgRole, type OrgRole } from "@elkdonis/services";
import { siteConfig } from "@/config/site";

/**
 * Access control for /manage. Same rule as amrit-canada: owner or guide in
 * user_organizations for this org, via @elkdonis/services — no email
 * allowlist, no reference to the global users.is_admin flag.
 *
 * src/lib/session.ts stays as-is (still used by /account, /[page], the auth
 * API routes) — this is a parallel, narrower module for the editorial surface.
 */

export const EDITOR_ROLES: OrgRole[] = ["owner", "guide"];

export interface Viewer {
  userId: string;
  email: string;
  role: OrgRole | null;
  canEdit: boolean;
  isMember: boolean;
}

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
    isMember: role !== null,
  };
}

export async function requireOrgEditor(returnTo = "/manage"): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (!viewer.canEdit) redirect("/");
  return viewer;
}

export async function getApiEditor(): Promise<Viewer | null> {
  const viewer = await getViewer();
  return viewer?.canEdit ? viewer : null;
}
