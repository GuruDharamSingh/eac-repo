import { getServerSession } from "@elkdonis/auth-server";
import { hasOrgRole } from "@elkdonis/services";
import { siteConfig } from "@/config/site";

/**
 * The membership check every /api/hub/* route runs first.
 *
 * Factored out rather than repeated because the hub's routes reach the org's
 * shared Nextcloud storage over the single service-account credential — which
 * can see every org's files. Nextcloud has no signal about who is asking, so
 * this check IS the boundary, the same argument org-deck.ts makes for boards.
 * Six copies of a boundary is six chances to write one of them slightly wrong.
 */
export type HubViewer = {
  userId: string;
  email: string;
  /** owner or guide — may write to shared storage and publish for the org. */
  canEdit: boolean;
};

export async function getHubViewer(): Promise<HubViewer | null> {
  const session = await getServerSession();
  if (!session.user) return null;

  const userId = session.user.db_user_id ?? session.user.id;
  const isMember = await hasOrgRole(userId, siteConfig.orgId, [
    "owner",
    "guide",
    "member",
  ]);
  if (!isMember) return null;

  const canEdit = await hasOrgRole(userId, siteConfig.orgId, [
    "owner",
    "guide",
  ]);
  return { userId, email: session.user.email, canEdit };
}

/** 403 rather than 401: they are signed in, they just aren't in IFAC. */
export function forbidden(message = "Members only") {
  return Response.json({ error: message }, { status: 403 });
}
