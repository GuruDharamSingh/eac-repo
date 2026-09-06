import "server-only";
import { db } from "@elkdonis/db";
import {
  createUnclaimedProfile,
  updateProfile,
  upsertOrgProfile,
  listOrgProfilesByEntityType,
  unpublishOrgProfile,
  type ProfileOrgMembership,
} from "@elkdonis/services";

/**
 * External businesses (galleries, curator collectives, auction houses) the
 * network has a relationship with — represented as `users` rows the same
 * way an unclaimed artist is (migration 092's entity_type='organization'),
 * published under whichever org sponsors the relationship. Not an account
 * with access: purely a directory/display entry, staff-edited here rather
 * than self-managed. Deliberately org-agnostic (an org picker, not a fixed
 * org_id) so this isn't IFAC-specific — any of the network's orgs can have
 * associated organizations of their own.
 *
 * Everything here routes through @elkdonis/services rather than duplicating
 * INSERT/UPDATE logic the way IFAC's own directory-admin.ts does — that
 * duplication is exactly what this module avoids repeating.
 */

export type OrgOption = { id: string; name: string; slug: string };

export async function listOrganizations(): Promise<OrgOption[]> {
  return db<OrgOption[]>`SELECT id, name, slug FROM organizations ORDER BY name`;
}

export async function listAssociatedOrgs(): Promise<ProfileOrgMembership[]> {
  return listOrgProfilesByEntityType("organization");
}

export type AssociatedOrgInput = {
  orgId: string;
  name: string;
  slug?: string;
  roleTitle?: string;
  headline?: string;
  bio?: string;
  city?: string;
  region?: string;
  country?: string;
  avatarUrl?: string;
  website?: string;
  tags?: string[];
};

function socialLinksFor(website?: string) {
  const url = website?.trim();
  return url ? [{ label: "Website", url }] : [];
}

// Non-discriminated on purpose: a true `{ok:true;...}|{ok:false;error}`
// union fails to narrow at `if (!result.ok) return result.error` call sites
// in this codebase (confirmed reproducible even with locally-defined types —
// see packages/services/src/profiles.ts's SaveResult precedent). `error`
// being optional either way means no narrowing is ever needed.
export type AssociatedOrgResult = { ok: boolean; userId?: string; slug?: string; error?: string };

export async function createAssociatedOrg(
  input: AssociatedOrgInput,
  createdBy: string
): Promise<AssociatedOrgResult> {
  const created = await createUnclaimedProfile({
    displayName: input.name,
    slug: input.slug,
    headline: input.headline || null,
    bio: input.bio || null,
    avatarUrl: input.avatarUrl || null,
    city: input.city || null,
    region: input.region || null,
    country: input.country || null,
    socialLinks: socialLinksFor(input.website),
    entityType: "organization",
    profileLayout: "standard",
    createdBy,
  });
  if (!created.ok) return created;

  // is_public stays false: that flag controls whether the sponsoring org's
  // own site surfaces this entry, which no org has UI for yet. It does not
  // hide the listing from ArtDirect — listPublicProfiles' only rule is
  // "has a slug" — so this is already visible on the network's directory.
  await upsertOrgProfile(input.orgId, created.userId, {
    roleTitle: input.roleTitle || null,
    tags: input.tags ?? [],
    isPublic: false,
  });
  return created;
}

export async function updateAssociatedOrg(
  userId: string,
  orgId: string,
  input: AssociatedOrgInput
): Promise<void> {
  await updateProfile(userId, {
    displayName: input.name,
    headline: input.headline || null,
    bio: input.bio || null,
    avatarUrl: input.avatarUrl || null,
    city: input.city || null,
    region: input.region || null,
    country: input.country || null,
    socialLinks: socialLinksFor(input.website),
    slug: input.slug,
  });
  await upsertOrgProfile(orgId, userId, {
    roleTitle: input.roleTitle || null,
    tags: input.tags ?? [],
  });
}

export async function deleteAssociatedOrg(orgId: string, userId: string): Promise<boolean> {
  return unpublishOrgProfile(orgId, userId);
}
