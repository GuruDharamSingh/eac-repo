import { db } from "@elkdonis/db";
import { isEnrolledInWorkshop, rsvpRoutes } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";

/**
 * Member RSVP for a thread shown on an org's network subdomain.
 *
 * The one RSVP logic is in @elkdonis/services (rsvp-handler.ts). This route
 * serves any org's threads (no org filter) and follows the member rule: a
 * published thread is RSVP-able whether it is public or members-only (#42).
 * A priced thread is refused with 402 until the paid branch is switched on.
 */

/**
 * Joining a workshop should also open its materials folder to you in
 * Nextcloud, and cancelling should close it again. Best-effort: most people
 * have no Nextcloud account and the workshop page serves materials through its
 * own gated route.
 */
async function syncMaterialsAccess(threadId: string, orgId: string, userId: string, grant: boolean): Promise<void> {
  try {
    const [ncUser] = await db<Array<{ nextcloud_user_id: string | null }>>`
      SELECT nextcloud_user_id FROM users
      WHERE id = ${userId} AND nextcloud_synced = true
      LIMIT 1
    `;
    if (!ncUser?.nextcloud_user_id) return;
    const { getAdminClient, grantMaterialsAccess, revokeMaterialsAccess } = await import("@elkdonis/nextcloud");
    const client = getAdminClient();
    if (grant) {
      await grantMaterialsAccess(client, orgId, threadId, ncUser.nextcloud_user_id, "attendee");
    } else {
      await revokeMaterialsAccess(client, orgId, threadId, ncUser.nextcloud_user_id);
    }
  } catch (err) {
    console.warn(`[arts-collective] materials access sync failed for ${threadId}:`, err);
  }
}

export const { POST, DELETE } = rsvpRoutes({
  orgId: null,
  orgName: "Elkdonis Arts Collective",
  label: "arts-collective",
  shape: "ok-count",
  signInMessage: "Sign in to RSVP.",
  who: async () => {
    const user = await getCurrentUser();
    return user ? { userId: user.id, email: user.email } : null;
  },
  onJoined: async ({ thread, userId }) => {
    if (thread.kind === "workshop") await syncMaterialsAccess(thread.id, thread.org_id, userId, true);
  },
  onLeft: async ({ thread, userId }) => {
    if (thread.kind !== "workshop") return;
    // Not from someone still entitled by another route (a paid join, or authoring).
    const stillEntitled = thread.author_id === userId || (await isEnrolledInWorkshop(thread.id, userId));
    if (!stillEntitled) await syncMaterialsAccess(thread.id, thread.org_id, userId, false);
  },
});
