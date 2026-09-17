"use server";

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { getCurrentUser } from "@/lib/session";
import {
  canEditProfile,
  getProfile,
  updateProfile,
  type UpdateProfileInput,
} from "@elkdonis/services";
import { isKnownLayout } from "@elkdonis/cms-ui/profile";
import {
  dossierFieldRegistry,
  DOSSIER_SECTION_KEYS,
  type DossierFieldMeta,
} from "@elkdonis/cms-bindings/dossier";

// ============================================================================
// Saving what a person types into their own file.
//
// Every write here is driven by `dossierFieldRegistry`, which is also what the
// sidebar draws its controls from and what the template's manifest is
// validated against. One declaration, so a field cannot exist in the UI with
// nowhere to land, or land in a column the renderer never reads — which is
// exactly what had happened: the registry named `directory_profiles` columns
// for a table that has not held a profile since migrations 084-087.
// ============================================================================

export type SaveResult = { ok: boolean; error?: string };

/** The value shapes a dossier field can hold. */
export type DossierFieldValue = string | string[] | Record<string, unknown>[];

async function authorize(profileUserId: string): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in required." };
  const allowed = await canEditProfile(user.id, profileUserId);
  if (!allowed) return { ok: false, error: "Not authorized to edit this profile." };
  return { ok: true };
}

async function revalidateProfile(profileUserId: string) {
  revalidatePath("/");
  const profile = await getProfile(profileUserId);
  if (profile?.slug) revalidatePath(`/${profile.slug}`);
}

/**
 * The `users` columns a dossier field may write, by column name.
 *
 * An explicit allow-list rather than a computed setter: the registry's `col` is
 * data that ships in a package, and turning it straight into a column name
 * would mean any future edit to that file could write to `is_admin`.
 */
const COLUMN_SETTERS: Record<string, (v: DossierFieldValue) => UpdateProfileInput> = {
  display_name: (v) => ({ displayName: String(v ?? "") }),
  headline: (v) => ({ headline: String(v ?? "") || null }),
  bio: (v) => ({ bio: String(v ?? "") || null }),
  avatar_url: (v) => ({ avatarUrl: String(v ?? "") || null }),
  social_links: (v) => ({
    socialLinks: (Array.isArray(v) ? v : [])
      .map((row) => {
        const o = (row ?? {}) as Record<string, unknown>;
        return { label: String(o.label ?? "").trim(), url: String(o.url ?? "").trim() };
      })
      .filter((l) => l.url !== ""),
  }),
};

/**
 * Coerce a submitted value to the shape the renderer expects.
 *
 * The distinction that matters is `list`: those fields are stored as an array
 * of strings and edited as a textarea. Writing the textarea's single string
 * straight through produces a section with one very long bullet, which is the
 * failure mode this function exists to prevent.
 */
function coerce(field: DossierFieldMeta, value: DossierFieldValue): unknown {
  if (field.list) {
    const lines = Array.isArray(value) ? value.map(String) : String(value ?? "").split("\n");
    return lines.map((l) => l.trim()).filter(Boolean);
  }

  if (field.input === "compound") {
    const rows = Array.isArray(value) ? value : [];
    const keys = field.itemFields?.map((f) => f.name) ?? [];
    return rows
      .map((row) => {
        const o = (row ?? {}) as Record<string, unknown>;
        const out: Record<string, string> = {};
        for (const key of keys) {
          const v = String(o[key] ?? "").trim();
          if (v) out[key] = v;
        }
        return out;
      })
      // A row whose FIRST field is empty is a row the person started and left.
      // Dropping it here is what keeps an accidental blank entry from
      // rendering as a nameless plate or an empty ledger line.
      .filter((row) => Boolean(row[keys[0]]));
  }

  return String(value ?? "").trim();
}

/**
 * Write one field of a dossier.
 *
 * `oad_dossier` keys are merged with `||` rather than read-modify-written, so
 * two fields saved at the same moment cannot clobber each other — the same
 * shape `setProfileSectionAction` uses on `profile_sections`.
 */
export async function saveDossierFieldAction(
  profileUserId: string,
  trait: string,
  value: DossierFieldValue
): Promise<SaveResult> {
  const auth = await authorize(profileUserId);
  if (!auth.ok) return auth;

  const field = dossierFieldRegistry[trait];
  if (!field) return { ok: false, error: `Unknown field: ${trait}` };

  const next = coerce(field, value);

  if (field.json) {
    await db`
      UPDATE users
      SET oad_dossier = COALESCE(oad_dossier, '{}'::jsonb) || ${db.json({ [field.col]: next } as never)}
      WHERE id = ${profileUserId}
    `;
  } else {
    const setter = COLUMN_SETTERS[field.col];
    if (!setter) return { ok: false, error: `Field ${trait} has no writable column.` };
    await updateProfile(profileUserId, setter(next as DossierFieldValue));
  }

  await revalidateProfile(profileUserId);
  return { ok: true };
}

/** Sections this page knows how to render. Anything else is refused, not stored. */
const KNOWN_PROFILE_SECTIONS: readonly string[] = ["store", ...DOSSIER_SECTION_KEYS];

/**
 * Switch an optional section on or off (`users.profile_sections`).
 *
 * The flag is network-wide on purpose: "show my store" means the same thing
 * here, on IFAC and on an org site, so a person decides it once.
 */
export async function setProfileSectionAction(
  profileUserId: string,
  key: string,
  on: boolean
): Promise<SaveResult> {
  const auth = await authorize(profileUserId);
  if (!auth.ok) return auth;
  if (!KNOWN_PROFILE_SECTIONS.includes(key)) {
    return { ok: false, error: `Unknown section: ${key}` };
  }

  await db`
    UPDATE users
    SET profile_sections = COALESCE(profile_sections, '{}'::jsonb) || ${db.json({ [key]: Boolean(on) } as never)}
    WHERE id = ${profileUserId}
  `;
  await revalidateProfile(profileUserId);
  return { ok: true };
}

/**
 * Choose how this person's profile is rendered (`users.profile_layout`).
 *
 * Validated against the shared layout list rather than a local one: the value
 * is read by every app that renders a profile, so an id that only ArtDirect
 * understands would render as the default everywhere else, and the person
 * would have chosen something that silently did not apply.
 */
export async function setProfileLayoutAction(
  profileUserId: string,
  layout: string
): Promise<SaveResult> {
  const auth = await authorize(profileUserId);
  if (!auth.ok) return auth;
  if (!isKnownLayout(layout)) return { ok: false, error: `Unknown layout: ${layout}` };

  await db`UPDATE users SET profile_layout = ${layout} WHERE id = ${profileUserId}`;
  await revalidateProfile(profileUserId);
  return { ok: true };
}
