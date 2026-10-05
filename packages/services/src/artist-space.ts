/**
 * "Gain your space": a person becomes an artist of the collective.
 *
 * Decided by the developer 2026-09-27: there is no network-level role column.
 * Membership in `oad` (ArtDirect, a placeholder org with no content of its
 * own) is what marks someone as an artist of the collective. Starting the
 * artist onboarding (/wizard on arts-collective) gains the space; the same
 * call is meant for a button on the hub and /center.
 *
 * Gaining a space:
 *  - adds an `oad` membership at `member` — never lowering an existing role
 *    (an oad guide or owner stays one), and upgrading a `viewer` row;
 *  - adds the org_profiles roster row, as joinOrgsOnSignIn does, because
 *    media-authz and ArtDirect read membership from both tables;
 *  - lists the person on ArtDirect (`users.directory_listed`) when the space
 *    is first gained — no separate publish step, and a later "hide me" choice
 *    is not overridden;
 *  - creates the artist_profiles row if missing, filed under the org the
 *    person owns, else `oad` (the column is NOT NULL);
 *  - creates their storage folder (users/<storage_folder>). Best effort: a
 *    Nextcloud outage must not block onboarding, and the first upload creates
 *    the folder anyway (uploadUserFile).
 *
 * Idempotent: safe to call on every visit to the onboarding.
 */

import { db } from '@elkdonis/db';
import { davConfigured, davMkcol } from './dav';
import { createUserFolder, USER_MEDIA_FOLDERS, userStorageRoot } from './user-storage';
import { ARTIST_SPACE_ORG_ID, markArtist } from './artist-membership';

export { ARTIST_SPACE_ORG_ID, hasGainedSpace } from './artist-membership';

export interface GainSpaceResult {
  /** The org the artist profile is filed under (owned org, else `oad`). */
  profileOrgId: string;
  /** False when the storage folder could not be created this time. */
  storageReady: boolean;
}

export async function gainSpace(userId: string): Promise<GainSpaceResult> {
  const oad = ARTIST_SPACE_ORG_ID;

  // oad member, roster row, listed on first gain only (artist-membership.ts).
  await markArtist(userId);
  const [user] = await db<Array<{ storage_folder: string | null }>>`
    SELECT storage_folder FROM users WHERE id = ${userId}
  `;

  const [owned] = await db<Array<{ org_id: string }>>`
    SELECT org_id FROM user_organizations
    WHERE user_id = ${userId} AND role = 'owner'
    ORDER BY joined_at
    LIMIT 1
  `;
  const [profile] = await db<Array<{ org_id: string }>>`
    INSERT INTO artist_profiles (user_id, org_id)
    VALUES (${userId}, ${owned?.org_id ?? oad})
    ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
    RETURNING org_id
  `;

  let storageReady = false;
  if (user?.storage_folder && davConfigured()) {
    try {
      storageReady = await davMkcol(userStorageRoot(user.storage_folder));
      for (const folder of USER_MEDIA_FOLDERS) {
        storageReady = (await createUserFolder(user.storage_folder, `Media/${folder}`)) && storageReady;
      }
    } catch (err) {
      console.error('[artist-space] storage folder:', err);
      storageReady = false;
    }
  }

  return { profileOrgId: profile.org_id, storageReady };
}
