import "server-only";
import { db } from "@elkdonis/db";
import { getOrgRole, removeOrgMember, setOrgRole, type OrgRole } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { setProfileVisibility } from "@/lib/directory-admin";

/**
 * People management for /manage/people.
 *
 * Three separate, reversible things get confused with each other constantly,
 * so they are three distinct operations here and three distinct controls in the
 * UI:
 *
 *   1. Listing   — whether the public site shows them (org_profiles.is_public).
 *                  Their account, their bio and their portfolio are untouched.
 *   2. Access    — what they may do inside IFAC (user_organizations.role).
 *   3. Membership— whether they are in IFAC at all (the row itself).
 *
 * None of them deletes a person. There is no account deletion in this console
 * on purpose: `users` rows are network-wide — one row can be an IFAC artist, an
 * ArtDirect profile and an art-auction seller at once — so deleting one here to
 * tidy IFAC's roster would take their identity out of every other org too. The
 * nearest safe thing, removing an unclaimed placeholder nobody has claimed, is
 * already what the directory's Delete does.
 */

/** Roles this console may assign. `owner` is not one of them — see setMemberRole. */
export const ASSIGNABLE_ROLES: OrgRole[] = ["viewer", "member", "guide"];

export interface ManageMember {
  userId: string;
  email: string;
  displayName: string | null;
  role: OrgRole;
  joinedAt: string;
  /** Network-wide superadmin. Shown so nobody wonders why they can do more. */
  isAdmin: boolean;
  /** Their IFAC roster entry, when they have one. */
  listing: {
    slug: string | null;
    kind: "artist" | "dealer";
    /** Whether the public site shows them right now. */
    isPublic: boolean;
  } | null;
}

export interface ManageContact {
  id: string;
  email: string;
  name: string | null;
  message: string | null;
  source: string | null;
  createdAt: string;
}

interface MemberRow {
  user_id: string;
  email: string;
  display_name: string | null;
  role: OrgRole;
  joined_at: string;
  is_admin: boolean;
  slug: string | null;
  tags: string[] | null;
  is_public: boolean | null;
}

/**
 * Everyone in IFAC, with their access role and whether the public site lists
 * them. One query rather than listOrgMembers + a second pass, because the
 * whole point of this screen is seeing access and listing side by side: they
 * are independent, and someone reading two tables will assume they aren't.
 *
 * LEFT JOIN, not JOIN — a member with no roster entry is the normal case for a
 * collector who never asked for an artist page, and an inner join would hide
 * exactly the people whose access you came here to change.
 */
export async function listManageMembers(): Promise<ManageMember[]> {
  const rows = await db<MemberRow[]>`
    SELECT
      uo.user_id, uo.role, uo.joined_at,
      u.email, u.display_name, u.is_admin, u.slug,
      op.tags, op.is_public
    FROM user_organizations uo
    JOIN users u ON u.id = uo.user_id
    LEFT JOIN org_profiles op
      ON op.user_id = uo.user_id AND op.org_id = uo.org_id
    WHERE uo.org_id = ${siteConfig.orgId}
    ORDER BY
      CASE uo.role WHEN 'owner' THEN 0 WHEN 'guide' THEN 1 WHEN 'member' THEN 2 ELSE 3 END,
      u.display_name NULLS LAST, u.email
  `;

  return rows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    displayName: r.display_name,
    role: r.role,
    joinedAt: new Date(r.joined_at).toISOString(),
    isAdmin: r.is_admin,
    listing:
      r.is_public === null
        ? null
        : {
            slug: r.slug,
            kind: r.tags?.includes("dealer") ? "dealer" : "artist",
            isPublic: r.is_public,
          },
  }));
}

export async function listManageContacts(limit = 60): Promise<ManageContact[]> {
  const rows = await db<Array<{
    id: string;
    email: string;
    name: string | null;
    message: string | null;
    source: string | null;
    created_at: string;
  }>>`
    SELECT id, email, name, message, source, created_at
    FROM contacts
    WHERE org_id = ${siteConfig.orgId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    message: r.message,
    source: r.source,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

/**
 * The shape every write here returns. A flat object rather than a discriminated
 * union because the repo compiles with `strict: false`, and without
 * strictNullChecks TypeScript will not narrow `{ ok: true } | { ok: false; … }`
 * on `!result.ok` — the union type-checks at the definition and then fails at
 * every call site. Same shape as adminAssignProfile's, so callers handling both
 * handle them the same way.
 */
export interface ManageResult {
  ok: boolean;
  error?: string;
}

/**
 * Every write below refuses two targets, and the refusal lives HERE rather
 * than in the route so a future second caller inherits it:
 *
 *   - yourself: locking yourself out of the console you are standing in is a
 *     mistake with no undo from inside the site.
 *   - an owner: the org's owner is not demotable or removable by a guide, and
 *     the last owner is not removable by anyone. That change belongs in central
 *     admin, where the consequences across the network are visible.
 */
async function guard(targetUserId: string, actorUserId: string): Promise<ManageResult> {
  if (!targetUserId) return { ok: false, error: "A user is required." };
  if (targetUserId === actorUserId) {
    return { ok: false, error: "You can't change your own access here." };
  }
  const role = await getOrgRole(targetUserId, siteConfig.orgId);
  if (role === null) return { ok: false, error: "That person isn't in IFAC." };
  if (role === "owner") {
    return { ok: false, error: "An owner's access is changed in central admin, not here." };
  }
  return { ok: true };
}

/** Access role within IFAC. Cannot grant `owner`, and never touches is_admin. */
export async function setMemberRole(
  targetUserId: string,
  actorUserId: string,
  role: string
): Promise<ManageResult> {
  if (!ASSIGNABLE_ROLES.includes(role as OrgRole)) {
    return { ok: false, error: "Pick viewer, member or guide." };
  }
  const allowed = await guard(targetUserId, actorUserId);
  if (!allowed.ok) return allowed;

  await setOrgRole(targetUserId, siteConfig.orgId, role as OrgRole);
  return { ok: true };
}

/** Show or hide them on the public site. Their account and content survive. */
export async function setMemberListed(
  targetUserId: string,
  actorUserId: string,
  isPublic: boolean
): Promise<ManageResult> {
  // No self-check needed for listing — hiding your own profile page is a
  // legitimate thing to do and costs you nothing — but an owner's listing is
  // still theirs to change. guard() covers both, so reuse it rather than
  // inventing a second rule.
  if (targetUserId !== actorUserId) {
    const allowed = await guard(targetUserId, actorUserId);
    if (!allowed.ok) return allowed;
  }
  const ok = await setProfileVisibility(targetUserId, isPublic);
  return ok ? { ok: true } : { ok: false, error: "That person has no IFAC profile to list." };
}

/**
 * Take them out of IFAC. Their `users` row, their profile content and their
 * memberships of other orgs all survive — this removes the one relation that
 * grants them access here, and with it their roster listing.
 */
export async function removeMember(
  targetUserId: string,
  actorUserId: string
): Promise<ManageResult> {
  const allowed = await guard(targetUserId, actorUserId);
  if (!allowed.ok) return allowed;

  // Unlist first. A removed member whose org_profiles row stayed public would
  // vanish from this console while still being shown on the front page — the
  // exact confusion this screen exists to end.
  await setProfileVisibility(targetUserId, false);
  const removed = await removeOrgMember(targetUserId, siteConfig.orgId);
  return removed ? { ok: true } : { ok: false, error: "They were not a member." };
}
