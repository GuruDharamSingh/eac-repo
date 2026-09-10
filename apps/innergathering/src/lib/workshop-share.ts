import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";

/**
 * Mirror a workshop's membership into Nextcloud.
 *
 * The materials folder is served to the browser through /api/media, gated by
 * enrolment in media-authz — that is what makes the page work. The Nextcloud
 * share is the second, optional door: a participant who has a Nextcloud
 * account of their own sees the same folder in their own Files, can sync it
 * to a phone, and the guide can drop files in from the desktop client. It
 * only works for people the platform has provisioned (`nextcloud_synced`),
 * so it is best-effort by design and never blocks an RSVP.
 */
export async function shareWorkshopMaterials(
  threadId: string,
  userId: string,
  role: "author" | "attendee" | "none"
): Promise<void> {
  try {
    const [row] = await db<{ nextcloud_user_id: string | null }[]>`
      SELECT nextcloud_user_id FROM users
      WHERE id = ${userId} AND nextcloud_synced = TRUE
      LIMIT 1
    `;
    const ncUserId = row?.nextcloud_user_id;
    if (!ncUserId) return;

    const nc = await import("@elkdonis/nextcloud");
    const client = nc.getAdminClient();
    if (role === "none") {
      await nc.revokeMaterialsAccess(client, siteConfig.orgId, threadId, ncUserId);
    } else {
      await nc.grantMaterialsAccess(client, siteConfig.orgId, threadId, ncUserId, role);
    }
  } catch (err) {
    console.warn(`[innergathering] materials share (${role}) for ${threadId}:`, err);
  }
}
