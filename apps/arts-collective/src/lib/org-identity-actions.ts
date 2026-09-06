"use server";

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { canEditOrgIdentity, updateProfile } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";

/**
 * Editing an ORGANISATION's own identity — its portrait, bio and where it is.
 *
 * Authority is `canEditOrgIdentity`, not `canEditProfile`: the row being
 * edited belongs to the org, and nobody signs in as an org, so the self-or-
 * admin rule can't answer. Owner/guide of that org, or a network admin.
 *
 * Non-discriminated result shape on purpose — a true `{ok:true}|{ok:false}`
 * union does not narrow at call sites in this codebase (see profiles.ts).
 */
export type SaveOrgIdentityResult = { ok: boolean; error?: string };

export interface OrgIdentityInput {
  displayName?: string;
  headline?: string;
  bio?: string;
  avatarUrl?: string;
  city?: string;
  region?: string;
  country?: string;
}

export async function saveOrgIdentityAction(
  orgId: string,
  input: OrgIdentityInput
): Promise<SaveOrgIdentityResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (!(await canEditOrgIdentity(user.id, orgId))) {
    return { ok: false, error: "You don't have permission to edit this org." };
  }

  const [org] = await db<Array<{ profile_user_id: string | null; slug: string }>>`
    SELECT profile_user_id, slug FROM organizations WHERE id = ${orgId} LIMIT 1
  `;
  if (!org) return { ok: false, error: "Organisation not found." };
  if (!org.profile_user_id) {
    // Only possible for an org created before migration 099 that the backfill
    // missed; /api/org/create creates this row for every org made since.
    return { ok: false, error: "This org has no identity record yet." };
  }

  const name = input.displayName?.trim();
  if (input.displayName !== undefined && !name) {
    return { ok: false, error: "A name is required." };
  }

  try {
    await updateProfile(org.profile_user_id, {
      ...(name ? { displayName: name } : {}),
      headline: input.headline?.trim() || null,
      bio: input.bio?.trim() || null,
      avatarUrl: input.avatarUrl?.trim() || null,
      city: input.city?.trim() || null,
      region: input.region?.trim() || null,
      country: input.country?.trim() || null,
    });

    // The org's display name lives in two places by design: `organizations.name`
    // is what the network calls it, `users.display_name` is what its own
    // profile says. Keep them together rather than letting them drift.
    if (name) {
      await db`UPDATE organizations SET name = ${name} WHERE id = ${orgId}`;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg === "reserved_slug" ? "That name is reserved." : "Could not save." };
  }

  revalidatePath("/hub/organization");
  revalidatePath(`/sites/${org.slug}/profile`);
  return { ok: true };
}
