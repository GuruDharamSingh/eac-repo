/**
 * The membership half of "gain your space" — oad member + roster + listing —
 * with no storage dependency, so the storage code can call it without an
 * import cycle (artist-space.ts imports user-storage.ts).
 *
 * Retracted 2026-11-24 (developer): the 2026-09-27 rule "everyone with a folder
 * under EAC_Network/users/ is an artist of the collective" no longer holds.
 * Writing to a person's own folder (an upload, a thread document, IFAC's staff
 * upload) does not make them an `oad` member or list them; the folder is
 * where their files live, nothing more. `oad` membership is a deliberate step
 * (`joinArtistSpace`, the arts-collective wizard, ArtDirect offerings), and a
 * person who only visited an org site stays a visitor of that org.
 */

import { db } from '@elkdonis/db';

export const ARTIST_SPACE_ORG_ID = 'oad';

/**
 * Make the person an `oad` member (raising a viewer row, never lowering a
 * higher role), add the roster row, and list them on ArtDirect the first time
 * only — a later "hide me" (presence.ts) is not overridden. Returns true when
 * the space was gained by this call.
 */
export async function markArtist(userId: string): Promise<boolean> {
  const gainedNow = await db<Array<{ user_id: string }>>`
    INSERT INTO user_organizations (user_id, org_id, role, joined_at)
    VALUES (${userId}, ${ARTIST_SPACE_ORG_ID}, 'member', NOW())
    ON CONFLICT (user_id, org_id)
    DO UPDATE SET role = 'member'
    WHERE user_organizations.role = 'viewer'
    RETURNING user_id
  `;
  await db`
    INSERT INTO org_profiles (org_id, user_id)
    VALUES (${ARTIST_SPACE_ORG_ID}, ${userId})
    ON CONFLICT (org_id, user_id) DO NOTHING
  `;
  if (gainedNow.length > 0) {
    await db`UPDATE users SET directory_listed = TRUE, updated_at = NOW() WHERE id = ${userId}`;
    return true;
  }
  return false;
}

/** Whether the person has gained a space (holds any role above viewer in `oad`). */
export async function hasGainedSpace(userId: string): Promise<boolean> {
  const [row] = await db<Array<{ role: string }>>`
    SELECT role FROM user_organizations
    WHERE user_id = ${userId} AND org_id = ${ARTIST_SPACE_ORG_ID} AND role <> 'viewer'
    LIMIT 1
  `;
  return Boolean(row);
}
