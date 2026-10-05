/**
 * The membership half of "gain your space" — oad member + roster + listing —
 * with no storage dependency, so the storage code can call it without an
 * import cycle (artist-space.ts imports user-storage.ts).
 *
 * Rule (developer, 2026-09-27): everyone with a folder under
 * EAC_Network/users/ is an artist of the collective, i.e. an `oad` member
 * listed on ArtDirect. Storing anything in a person's own folder therefore
 * gains their space: createUserFolder (every per-person upload goes through
 * it), thread documents, and IFAC's staff upload call in here.
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

/**
 * markArtist for the owner of a users/<storage_folder> folder. Never throws:
 * a storage write must not fail because the membership bookkeeping did.
 * Only persons are marked; an organisation's profile user is left alone.
 */
export async function markArtistByFolder(storageFolder: string): Promise<void> {
  try {
    const [row] = await db<Array<{ id: string }>>`
      SELECT id FROM users
      WHERE storage_folder = ${storageFolder} AND entity_type = 'person'
      LIMIT 1
    `;
    if (row) await markArtist(row.id);
  } catch (err) {
    console.error(`[artist-membership] markArtistByFolder(${storageFolder}):`, err);
  }
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
