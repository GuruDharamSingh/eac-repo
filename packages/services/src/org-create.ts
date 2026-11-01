import { db } from '@elkdonis/db';
import { isReservedSlug } from '@elkdonis/utils';
import { getAdminClient, grantOrgAccess, provisionOrgOnNextcloud } from '@elkdonis/nextcloud';
import { createUnclaimedProfile } from './profiles';

// ============================================================================
// Start an organisation: one function for every caller.
//
// This was the body of arts-collective's POST /api/org/create. It moved here
// (2026-10-18) so the Center's "Start an organisation" journey can create one
// from any org site, in place, instead of sending the person to another
// domain; the route now calls this.
//
//   name + subdomain (the slug, which becomes <slug>.<network host>)
//     → organizations row (subdomain_confirmed = false: every org begins with
//       an intake conversation and an admin confirms it from /hub/admin; the
//       owner sees the real site throughout)
//     → the creator as `owner`
//     → the org's own identity row (migration 099), claimed by the owner
//     → its Nextcloud folder tree (best effort)
//
// NOT done here, and not automatic anywhere: the proxy host and certificate
// for <slug>.<network host> (docs/reference/ops.md, "Launch an org site on a
// subdomain"). Until an operator adds them the address answers with the
// edge's 404 over HTTP and a TLS failure over HTTPS; the org is reachable
// through the network hub at /hub/organization?org=<slug> meanwhile.
// ============================================================================

export const ORG_TIERS = ['free', 'supported', 'partner'] as const;
export type OrgTier = (typeof ORG_TIERS)[number];

export interface CreateOrgInput {
  /** The signed-in person. Becomes the owner. Never read from request params. */
  userId: string;
  /** What the organisation is called. */
  title: string;
  /** The address; normalised, so "My Studio!" becomes "my-studio". */
  subdomain: string;
  /** Self-declared; an admin confirms it after intake. Defaults to free. */
  tier?: string;
}

export type CreateOrgResult =
  | { ok: true; slug: string; tier: OrgTier }
  | { ok: false; error: string; code?: 'invalid' | 'taken' | 'failed' };

export function normalizeSubdomain(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * The reserved-word check is the shared list (packages/utils reserved-slugs):
 * an org slug becomes a network subdomain, so it must not collide with
 * infrastructure hosts (`artdirect`, `www`) or app routes.
 */
export function isValidSubdomain(s: string): boolean {
  if (s.length < 3 || s.length > 40) return false;
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(s)) return false;
  if (isReservedSlug(s)) return false;
  return true;
}

/** Is this address free and allowed? For the form's live check; not a reservation. */
export async function checkSubdomain(
  raw: string
): Promise<{ slug: string; ok: boolean; reason?: 'invalid' | 'taken' }> {
  const slug = normalizeSubdomain(raw);
  if (!isValidSubdomain(slug)) return { slug, ok: false, reason: 'invalid' };
  const [hit] = await db<Array<{ slug: string }>>`SELECT slug FROM organizations WHERE slug = ${slug} LIMIT 1`;
  return hit ? { slug, ok: false, reason: 'taken' } : { slug, ok: true };
}

export async function createOrganizationForUser(input: CreateOrgInput): Promise<CreateOrgResult> {
  const title = (input.title ?? '').trim();
  const tier: OrgTier = (ORG_TIERS as readonly string[]).includes(input.tier ?? '') ? (input.tier as OrgTier) : 'free';
  const subdomain = normalizeSubdomain(input.subdomain ?? '');

  if (!isValidSubdomain(subdomain)) {
    return { ok: false, code: 'invalid', error: 'The address must be 3–40 lowercase letters, numbers or hyphens, and not a reserved word.' };
  }
  if (title.length < 2 || title.length > 120) {
    return { ok: false, code: 'invalid', error: 'The name must be 2–120 characters.' };
  }

  // A person may own several orgs; the only collision that matters is the slug.
  const [collision] = await db<Array<{ slug: string }>>`SELECT slug FROM organizations WHERE slug = ${subdomain} LIMIT 1`;
  if (collision) return { ok: false, code: 'taken', error: 'That address is taken. Try another.' };

  try {
    await db.begin(async (tx) => {
      await tx`
        INSERT INTO organizations (id, name, slug, description, subdomain_confirmed, tier)
        VALUES (${subdomain}, ${title}, ${subdomain}, ${null}, false, ${tier})
      `;
      await tx`
        INSERT INTO user_organizations (user_id, org_id, role)
        VALUES (${input.userId}, ${subdomain}, 'owner')
        ON CONFLICT (user_id, org_id) DO NOTHING
      `;
      // Legacy artist_profiles is keyed on user_id alone, so a second org
      // simply keeps the person's existing row (DO NOTHING).
      await tx`
        INSERT INTO artist_profiles (user_id, org_id, display_name)
        VALUES (${input.userId}, ${subdomain}, ${title})
        ON CONFLICT (user_id) DO NOTHING
      `;
    });
  } catch (err) {
    console.error('[org-create] insert failed', err);
    return { ok: false, code: 'failed', error: 'Could not create the organisation.' };
  }

  // Every org carries its own identity row (migration 099): its bio, portrait
  // and directory listing belong to the organisation, not to whichever member
  // happens to be first.
  try {
    const created = await createUnclaimedProfile({
      displayName: title,
      slug: subdomain,
      entityType: 'organization',
      profileLayout: 'standard',
      createdBy: input.userId,
      sourceNote: `org:${subdomain}`,
    });
    if (created.ok) {
      await db`UPDATE organizations SET profile_user_id = ${created.userId} WHERE id = ${subdomain}`;
      // The owner created it, so it is claimed from the start.
      await db`UPDATE users SET claim_status = 'claimed', claimed_by = ${input.userId} WHERE id = ${created.userId}`;
    } else {
      console.warn('[org-create] identity profile not created:', 'error' in created ? created.error : 'unknown');
    }
  } catch (err) {
    // The org is created and usable; a missing identity row shows as an empty /profile.
    console.warn('[org-create] identity profile deferred:', err);
  }

  // Best-effort Nextcloud: the org folder tree under the service account,
  // shared read/write to the owner if they already have NC credentials.
  // Failures do not block creation; the Silex token route re-runs the same
  // idempotent provisioning on first editor launch.
  try {
    const admin = getAdminClient();
    const { orgFolderPath } = await provisionOrgOnNextcloud(admin, subdomain);
    await db`UPDATE organizations SET nextcloud_folder_path = ${orgFolderPath} WHERE id = ${subdomain}`;
    const [owner] = await db<Array<{ nextcloud_user_id: string | null }>>`
      SELECT nextcloud_user_id FROM users WHERE id = ${input.userId} LIMIT 1
    `;
    if (owner?.nextcloud_user_id) await grantOrgAccess(admin, subdomain, owner.nextcloud_user_id, 'owner');
  } catch (err) {
    console.warn('[org-create] nextcloud provisioning deferred:', err);
  }

  return { ok: true, slug: subdomain, tier };
}
