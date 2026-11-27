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
 *  - fills a blank platform picture and bio from their org profiles
 *    (portOrgProfile);
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
import { acceptAgreement } from './agreements';
import { followOrg } from './org-membership';

export { ARTIST_SPACE_ORG_ID, hasGainedSpace } from './artist-membership';

export interface GainSpaceResult {
  /** The org the artist profile is filed under (owned org, else `oad`). */
  profileOrgId: string;
  /** False when the storage folder could not be created this time. */
  storageReady: boolean;
}

/**
 * Carry what a person set up on an org site over to their platform profile
 * (the `users` row ArtDirect shows), when they join the platform: the org
 * picture becomes the avatar and the org bio the bio (as plain text, because
 * ArtDirect and IFAC read `users.bio` as text). The org role title is not
 * carried: it names a role in that org ("Director of Web Development",
 * "Museum"), not a platform headline.
 *
 * Fills blanks only, never overwrites, so it is safe on every call. Where
 * several orgs have a value, the most recently edited wins. The `oad` row is
 * skipped: it is the platform profile's own roster entry.
 */
export async function portOrgProfile(userId: string): Promise<void> {
  await db`
    UPDATE users u SET
      avatar_url = COALESCE(NULLIF(u.avatar_url, ''), (
        SELECT NULLIF(op.photo_override, '') FROM org_profiles op
        WHERE op.user_id = u.id AND op.org_id <> ${ARTIST_SPACE_ORG_ID} AND NULLIF(op.photo_override, '') IS NOT NULL
        ORDER BY op.updated_at DESC LIMIT 1)),
      bio = COALESCE(NULLIF(u.bio, ''), (
        SELECT NULLIF(btrim(regexp_replace(op.bio_override, '<[^>]*>', '', 'g')), '') FROM org_profiles op
        WHERE op.user_id = u.id AND op.org_id <> ${ARTIST_SPACE_ORG_ID} AND NULLIF(btrim(regexp_replace(op.bio_override, '<[^>]*>', '', 'g')), '') IS NOT NULL
        ORDER BY op.updated_at DESC LIMIT 1))
    WHERE u.id = ${userId}
  `;
}

export async function gainSpace(userId: string): Promise<GainSpaceResult> {
  const oad = ARTIST_SPACE_ORG_ID;

  // oad member, roster row, listed on first gain only (artist-membership.ts).
  await markArtist(userId);
  // What they set up for an org becomes their platform profile where that is blank.
  await portOrgProfile(userId);
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

// ─── Joining as an artist (agreement + optional affiliation) ────────────────

/**
 * The agreement a person accepts when they join as an artist: the active
 * `artist-space` row under `oad` (migration 290, published from the hub).
 * Null until it is published, which the join page reports instead of offering
 * a button that could not succeed.
 */
export const ARTIST_AGREEMENT_KEY = 'artist-space';

export interface ArtistAgreement {
  id: string;
  version: number;
  title: string;
  summary: string | null;
  bodyHtml: string | null;
}

export async function getArtistAgreement(): Promise<ArtistAgreement | null> {
  const rows = await db<Array<{ id: string; version: number; title: string; summary: string | null; body_html: string | null }>>`
    SELECT id, version, title, summary, body_html FROM org_agreements
    WHERE org_id = ${ARTIST_SPACE_ORG_ID} AND key = ${ARTIST_AGREEMENT_KEY} AND status = 'active'
    LIMIT 1
  `.catch(() => []);
  const r = rows[0];
  return r ? { id: r.id, version: r.version, title: r.title, summary: r.summary, bodyHtml: r.body_html } : null;
}

export interface AffiliationOrg {
  orgId: string;
  name: string;
}

/**
 * Organisations offered in the "already part of an org?" list: live (subdomain
 * confirmed), not private, with a real person as owner. The network's own
 * placeholder orgs are left out. Choosing one records a follow (`viewer`), not
 * membership: roles above `viewer` are conferred by the org's owners.
 */
export async function listAffiliationOrgs(): Promise<AffiliationOrg[]> {
  const rows = await db<Array<{ id: string; name: string }>>`
    SELECT o.id, o.name FROM organizations o
    WHERE o.join_policy <> 'private'
      AND o.subdomain_confirmed
      AND o.id NOT IN ('elkdonis', 'oad', 'market')
      AND EXISTS (
        SELECT 1 FROM user_organizations uo JOIN users u ON u.id = uo.user_id
        WHERE uo.org_id = o.id AND uo.role = 'owner'
          AND COALESCE(u.entity_type, 'person') = 'person'
      )
    ORDER BY o.name
  `.catch(() => []);
  return rows.map((r) => ({ orgId: r.id, name: r.name }));
}

export type JoinArtistSpaceResult =
  | { ok: true; result: GainSpaceResult }
  | { ok: false; error: string };

/**
 * "Join the collective as an artist": accept the agreement, follow any orgs the
 * person says they already belong to, then gain the space (`oad` member,
 * roster row, ArtDirect listing, artist profile, storage folder).
 *
 * `agreementId` must be the currently active version: a page left open across
 * a new version is asked to reload rather than accepting text it never saw.
 */
export async function joinArtistSpace(
  userId: string,
  input: { agreementId: string; orgIds?: string[] }
): Promise<JoinArtistSpaceResult> {
  const agreement = await getArtistAgreement();
  if (!agreement) return { ok: false, error: 'The artist agreement has not been published yet.' };
  if (agreement.id !== input.agreementId) {
    return { ok: false, error: 'The agreement has changed. Reload the page and read it again.' };
  }

  const accepted = await acceptAgreement(agreement.id, userId);
  if (!accepted.ok) return { ok: false, error: accepted.error ?? 'Could not record your acceptance.' };

  const wanted = Array.from(new Set(input.orgIds ?? []));
  if (wanted.length > 0) {
    const allowed = new Set((await listAffiliationOrgs()).map((o) => o.orgId));
    for (const orgId of wanted) {
      if (allowed.has(orgId)) await followOrg(userId, orgId);
    }
  }

  return { ok: true, result: await gainSpace(userId) };
}
