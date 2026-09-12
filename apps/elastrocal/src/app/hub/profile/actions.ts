"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getProfile, updateProfile, upsertOrgProfile } from "@elkdonis/services";
import { requireOrgMember } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * Server actions for /hub/profile. A server action is a public endpoint, so
 * each one re-checks authorisation itself rather than trusting the page.
 * A member edits their OWN identity (users) and their listing on THIS org
 * (org_profiles); publishing the listing is allowed to any member here —
 * the org is the guide's own.
 */

const schema = z.object({
  displayName: z.string().trim().min(1, "A name is needed").max(120),
  headline: z.string().trim().max(160).optional(),
  bio: z.string().trim().max(5000).optional(),
  pronouns: z.string().trim().max(40).optional(),
  city: z.string().trim().max(120).optional(),
  roleTitle: z.string().trim().max(120).optional(),
  isPublic: z.boolean().default(true),
});

export type ProfileFormInput = z.infer<typeof schema>;

export async function saveProfileAction(input: ProfileFormInput): Promise<{ ok: boolean; error?: string }> {
  const viewer = await requireOrgMember("/hub/profile");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const d = parsed.data;

  try {
    await updateProfile(viewer.userId, {
      displayName: d.displayName,
      headline: d.headline || null,
      bio: d.bio || null,
      pronouns: d.pronouns || null,
      city: d.city || null,
    });
    const existing = await getProfile(viewer.userId).catch(() => null);
    await upsertOrgProfile(siteConfig.orgId, viewer.userId, {
      roleTitle: d.roleTitle || null,
      sortOrder: 1,
      isPublic: d.isPublic,
    });
    revalidatePath("/people");
    if (existing?.slug) revalidatePath(`/people/${existing.slug}`);
    revalidatePath("/hub");
    return { ok: true };
  } catch (err) {
    console.error("[elastrocal] saveProfileAction", err);
    return { ok: false, error: "The profile could not be saved" };
  }
}
