import { db } from "@elkdonis/db";
import { isEnrolledInWorkshop, type rsvpRoutes } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";

/**
 * Options of the RSVP door the single-offer page uses: the same logic as
 * `/api/threads/[id]/rsvp` plus `followOnRsvp`, so an RSVP also makes the
 * person a follower of the thread's org (a `viewer` row, never mail). Refused
 * (403) for orgs whose join policy is not open. Kept apart from the existing
 * route so its callers behave as before (2026-11-27).
 */
type Options = Parameters<typeof rsvpRoutes>[0];

async function syncMaterialsAccess(threadId: string, orgId: string, userId: string, grant: boolean): Promise<void> {
  try {
    const [ncUser] = await db<Array<{ nextcloud_user_id: string | null }>>`
      SELECT nextcloud_user_id FROM users WHERE id = ${userId} AND nextcloud_synced = true LIMIT 1
    `;
    if (!ncUser?.nextcloud_user_id) return;
    const { getAdminClient, grantMaterialsAccess, revokeMaterialsAccess } = await import("@elkdonis/nextcloud");
    const client = getAdminClient();
    if (grant) await grantMaterialsAccess(client, orgId, threadId, ncUser.nextcloud_user_id, "attendee");
    else await revokeMaterialsAccess(client, orgId, threadId, ncUser.nextcloud_user_id);
  } catch (err) {
    console.warn(`[arts-collective] materials access sync failed for ${threadId}:`, err);
  }
}

export const rsvpFollowOptions: Options = {
  orgId: null,
  orgName: "Elkdonis Arts Collective",
  label: "arts-collective",
  shape: "ok-count",
  signInMessage: "Sign in to RSVP.",
  followOnRsvp: true,
  who: async () => {
    const user = await getCurrentUser();
    return user ? { userId: user.id, email: user.email } : null;
  },
  onJoined: async ({ thread, userId }) => {
    if (thread.kind === "workshop") await syncMaterialsAccess(thread.id, thread.org_id, userId, true);
  },
  onLeft: async ({ thread, userId }) => {
    if (thread.kind !== "workshop") return;
    const stillEntitled = thread.author_id === userId || (await isEnrolledInWorkshop(thread.id, userId));
    if (!stillEntitled) await syncMaterialsAccess(thread.id, thread.org_id, userId, false);
  },
};
