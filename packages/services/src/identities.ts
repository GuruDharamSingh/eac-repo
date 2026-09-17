import { db } from '@elkdonis/db';
import { ensureUniqueUserSlug } from './profiles';

// ============================================================================
// Identities — one account, several names.
//
// The network has always separated ACCOUNT from IDENTITY without naming the
// split. A login is a row in auth.users. An identity is a row in public.users,
// and it is what every content table actually points at — threads.author_id,
// media.uploaded_by, store.owner_user_id, user_organizations.user_id. Most
// identities on this database have no login behind them at all: unclaimed
// ArtDirect dossiers, and the organisations' own profile rows from migration
// 099.
//
// So a pen name is not a new kind of object. It is an ordinary users row with
// no login, plus one recorded fact — which account may speak as it
// (identity_control, migration 132).
//
// The same mechanism answers "post as my organisation": an org's identity is
// already a users row, hanging off organizations.profile_user_id. Speaking as
// a pen name and speaking as a body are the same act with a different target,
// which is why there is one resolver here and not two.
//
// THE THREE RELATIONS
//   self         the account's own row. Always present, never retired.
//   pseudonym    a users row it controls. Authorship is genuinely separate:
//                the link lives only in identity_control and is never read
//                into a public profile.
//   organization the org's identity row, actable by its owners and guides.
//                Unlike a pseudonym this is not private — everyone can see
//                who runs an org — and it is not exclusive.
//
// PRIVACY IS A PROPERTY OF THE QUERIES, NOT OF THE ROW
// A pseudonym's row looks like anyone else's. What keeps it separate is that
// nothing public ever joins identity_control, and that the row is created
// with no back-reference of its own: created_by, claimed_by and source_note
// are deliberately left NULL, because all three are carried by USER_COLS in
// ./profiles into every profile read and from there to the browser. Writing
// the owner's id into any of them would publish the link.
// ============================================================================

/** How many extra names one account may hold. Policy, not structure — the
 *  DB deliberately has no CHECK for this (see migration 132). */
export const MAX_PSEUDONYMS = 2;

export type IdentityRelation = 'self' | 'pseudonym' | 'organization';

export interface ActingIdentity {
  id: string;
  relation: IdentityRelation;
  displayName: string;
  slug: string | null;
  avatarUrl: string | null;
  /** Set only when relation === 'organization'. */
  orgId?: string;
  /** Set only when relation === 'organization': the role that permits it. */
  orgRole?: string;
  /** Private note, pseudonyms only. Never leaves the owner's own screens. */
  label?: string | null;
  retiredAt?: Date | null;
}

/**
 * Every identity whose authorship belongs to this account — its own row plus
 * its live pseudonyms. This is the set that must replace `author_id = viewer`
 * anywhere that clause grants VISIBILITY, or a person loses sight of their own
 * drafts the moment they write under a pen name.
 *
 * Organisation identities are NOT included: an org's threads belong to the
 * org, and are seen through org membership, not through personal authorship.
 */
export async function getIdentityIds(accountId: string | null): Promise<string[]> {
  if (!accountId) return [];
  const rows = await db<Array<{ identity_id: string }>>`
    SELECT identity_id FROM identity_control
    WHERE account_id = ${accountId} AND retired_at IS NULL
  `;
  return [accountId, ...rows.map((r) => r.identity_id)];
}

/** The identities this account may post as, for an identity picker. */
export async function listActingIdentities(accountId: string): Promise<ActingIdentity[]> {
  const [self] = await db<Array<{ id: string; display_name: string | null; slug: string | null; avatar_url: string | null }>>`
    SELECT id, display_name, slug, avatar_url FROM users WHERE id = ${accountId}
  `;
  if (!self) return [];

  const pseudonyms = await db<Array<{ id: string; display_name: string | null; slug: string | null; avatar_url: string | null; label: string | null; retired_at: Date | null }>>`
    SELECT u.id, u.display_name, u.slug, u.avatar_url, ic.label, ic.retired_at
    FROM identity_control ic JOIN users u ON u.id = ic.identity_id
    WHERE ic.account_id = ${accountId}
    ORDER BY ic.created_at
  `;

  const orgs = await db<Array<{ id: string; display_name: string | null; slug: string | null; avatar_url: string | null; org_id: string; role: string }>>`
    SELECT u.id, u.display_name, u.slug, u.avatar_url, o.id AS org_id, uo.role
    FROM user_organizations uo
    JOIN organizations o ON o.id = uo.org_id
    JOIN users u ON u.id = o.profile_user_id
    WHERE uo.user_id = ${accountId} AND uo.role IN ('owner', 'guide')
    ORDER BY o.name
  `;

  return [
    {
      id: self.id,
      relation: 'self' as const,
      displayName: self.display_name ?? 'You',
      slug: self.slug,
      avatarUrl: self.avatar_url,
    },
    ...pseudonyms.map((p) => ({
      id: p.id,
      relation: 'pseudonym' as const,
      displayName: p.display_name ?? 'Unnamed',
      slug: p.slug,
      avatarUrl: p.avatar_url,
      label: p.label,
      retiredAt: p.retired_at,
    })),
    ...orgs.map((o) => ({
      id: o.id,
      relation: 'organization' as const,
      displayName: o.display_name ?? o.org_id,
      slug: o.slug,
      avatarUrl: o.avatar_url,
      orgId: o.org_id,
      orgRole: o.role,
    })),
  ];
}

/**
 * The gate every write path must pass an incoming "post as" through. Returns
 * the identity id to record as the author, or an error.
 *
 * Callers must never take an identity id from the request and use it
 * directly: that is the whole authorisation boundary for speaking as someone
 * else.
 */
export async function resolveActor(
  accountId: string,
  requestedIdentityId?: string | null
): Promise<{ ok: true; identityId: string; relation: IdentityRelation } | { ok: false; error: string }> {
  if (!requestedIdentityId || requestedIdentityId === accountId) {
    return { ok: true, identityId: accountId, relation: 'self' };
  }

  const [pseudonym] = await db<Array<{ retired_at: Date | null }>>`
    SELECT retired_at FROM identity_control
    WHERE identity_id = ${requestedIdentityId} AND account_id = ${accountId}
  `;
  if (pseudonym) {
    if (pseudonym.retired_at) return { ok: false, error: 'That name has been retired.' };
    return { ok: true, identityId: requestedIdentityId, relation: 'pseudonym' };
  }

  const [org] = await db<Array<{ org_id: string }>>`
    SELECT o.id AS org_id
    FROM organizations o
    JOIN user_organizations uo ON uo.org_id = o.id AND uo.user_id = ${accountId}
    WHERE o.profile_user_id = ${requestedIdentityId} AND uo.role IN ('owner', 'guide')
  `;
  if (org) return { ok: true, identityId: requestedIdentityId, relation: 'organization' };

  return { ok: false, error: 'You cannot post as that.' };
}

export interface CreatePseudonymInput {
  displayName: string;
  /** Desired slug; uniqueness is enforced, reserved words rejected. */
  slug?: string;
  headline?: string | null;
  bio?: string | null;
  /** Private note for the owner. Never public. */
  label?: string | null;
}

/**
 * Open a second name for an account.
 *
 * directory_listed is FALSE on purpose. The network directory lists on
 * `slug IS NOT NULL AND directory_listed` (forum.ts, profiles.ts) with no
 * entity_type filter, so a row created with the column's TRUE default would
 * walk straight into ArtDirect and the member counts the moment it existed.
 * A pen name becomes public when its owner says so, not when it is created.
 */
export async function createPseudonym(
  accountId: string,
  input: CreatePseudonymInput
): Promise<{ ok: true; identityId: string; slug: string } | { ok: false; error: string }> {
  const displayName = (input.displayName ?? '').trim().replace(/\s+/g, ' ');
  if (displayName.length < 2) return { ok: false, error: 'Give the name at least two characters.' };
  if (displayName.length > 120) return { ok: false, error: 'That name is too long.' };

  const [controlled] = await db<Array<{ identity_id: string }>>`
    SELECT identity_id FROM identity_control WHERE identity_id = ${accountId}
  `;
  if (controlled) return { ok: false, error: 'A pen name cannot hold pen names of its own.' };

  const [{ n }] = await db<Array<{ n: number }>>`
    SELECT COUNT(*)::int AS n FROM identity_control
    WHERE account_id = ${accountId} AND retired_at IS NULL
  `;
  if (n >= MAX_PSEUDONYMS) {
    return { ok: false, error: `You can hold ${MAX_PSEUDONYMS} other names at a time. Retire one first.` };
  }

  const slug = await ensureUniqueUserSlug(input.slug || displayName);
  const newId = crypto.randomUUID();

  try {
    await db.begin(async (tx) => {
      // created_by / claimed_by / source_note stay NULL — all three are read
      // into public profiles by USER_COLS, and any of them would publish the
      // link back to the owner. identity_control is the only record of it.
      await tx`
        INSERT INTO users (
          id, auth_user_id, display_name, headline, bio, slug,
          entity_type, claim_status, directory_listed, profile_layout
        ) VALUES (
          ${newId}, ${newId}, ${displayName}, ${input.headline ?? null}, ${input.bio ?? null}, ${slug},
          'person', 'claimed', FALSE, 'dossier'
        )
      `;
      await tx`
        INSERT INTO identity_control (identity_id, account_id, relation, label)
        VALUES (${newId}, ${accountId}, 'pseudonym', ${input.label ?? null})
      `;
    });
  } catch (err) {
    console.error('[identities] createPseudonym:', err);
    return { ok: false, error: 'Could not open that name.' };
  }

  return { ok: true, identityId: newId, slug };
}

/**
 * Stop acting as a pen name while leaving everything it wrote standing under
 * its own byline. Reversible.
 *
 * Folding the name back into its owner — reassigning authorship and deleting
 * the row — is mergeProfile in ./profiles, which refuses when any of sixteen
 * uncarried tables holds rows. That is a different, irreversible operation and
 * is deliberately not what this does.
 */
export async function retirePseudonym(
  accountId: string,
  identityId: string
): Promise<{ ok: boolean; error?: string }> {
  const rows = await db`
    UPDATE identity_control SET retired_at = now()
    WHERE identity_id = ${identityId} AND account_id = ${accountId} AND retired_at IS NULL
    RETURNING identity_id
  `;
  if (!rows.length) return { ok: false, error: 'No such name.' };
  return { ok: true };
}

/** Undo a retirement. */
export async function restorePseudonym(
  accountId: string,
  identityId: string
): Promise<{ ok: boolean; error?: string }> {
  const [{ n }] = await db<Array<{ n: number }>>`
    SELECT COUNT(*)::int AS n FROM identity_control
    WHERE account_id = ${accountId} AND retired_at IS NULL
  `;
  if (n >= MAX_PSEUDONYMS) return { ok: false, error: 'Retire another name first.' };
  const rows = await db`
    UPDATE identity_control SET retired_at = NULL
    WHERE identity_id = ${identityId} AND account_id = ${accountId}
    RETURNING identity_id
  `;
  if (!rows.length) return { ok: false, error: 'No such name.' };
  return { ok: true };
}

/**
 * The account behind an identity, or null.
 *
 * SERVER-SIDE ONLY, and not for display. This is the de-anonymising read:
 * it exists for moderation and for per-account accounting (rate limits,
 * payouts), and its result must never reach a response body. Anything that
 * needs to show a byline should read users.display_name for the identity
 * itself.
 */
export async function accountForIdentity(identityId: string): Promise<string | null> {
  const [row] = await db<Array<{ account_id: string }>>`
    SELECT account_id FROM identity_control WHERE identity_id = ${identityId}
  `;
  return row?.account_id ?? null;
}
