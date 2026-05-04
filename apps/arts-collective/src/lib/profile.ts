import { db } from "@elkdonis/db";
import type { WizardAnswers } from "@/lib/schema";

export type ArtistProfileRow = {
  user_id: string;
  org_id: string;
  display_name: string | null;
  pronouns: string | null;
  city: string | null;
  bio: string | null;
  photo_url: string | null;
  disciplines: string[];
  disciplines_other: string | null;
  experience_level: string | null;
  audience_description: string | null;
  audience_value: string | null;
  portfolio_url: string | null;
  audience_types: string[];
  client_base: string[];
  goals_seeking: string | null;
  goals_offering: string | null;
  goals_options: string[];
  mutual_aid_media: boolean;
  mutual_aid_authoring: boolean;
  personal_philosophy: string | null;
  aesthetic_keywords: string[];
  aesthetic_notes: string | null;
  needs: string[];
  features_requested: string[];
  features_other: string | null;
  template_preference: string | null;
  palette_preference: string | null;

  // Business fields (Approachable v2)
  biz_entity_type: string | null;
  biz_entity_name: string | null;
  biz_mission: string | null;
  biz_legal_status: string | null;
  biz_primary_revenue: string[];
  biz_capacity: string | null;
  biz_pricing_philosophy: string | null;
  biz_tools: string | null;
  biz_fulfillment: string | null;
  biz_inventory_management: string | null;
  biz_desired_resources: string[];
  biz_revenue_sharing: string | null;
  biz_skill_share: string | null;
  biz_main_barrier: string | null;
  biz_revenue_goal: string | null;
};

/**
 * Fetch the artist_profiles row for a user, if any.
 * Returns null only if the user has no row (should be rare once the
 * org-at-signup flow is in place).
 */
export async function getProfileForUser(
  userId: string
): Promise<ArtistProfileRow | null> {
  try {
    const rows = await db<ArtistProfileRow[]>`
      SELECT * FROM artist_profiles WHERE user_id = ${userId} LIMIT 1
    `;
    return rows[0] ?? null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .*artist_profiles.* does not exist/i.test(msg)) {
      return null;
    }
    throw err;
  }
}

/**
 * True if the profile has enough filled in that the Artist Profile card
 * should read as "complete" on the hub. We treat all 8 wizard steps' core
 * fields as the bar.
 */
export function isProfileComplete(row: ArtistProfileRow | null): boolean {
  if (!row) return false;
  if (!row.display_name || !row.city || !row.bio) return false;
  if (!row.disciplines || row.disciplines.length === 0) return false;
  if (!row.experience_level) return false;
  if (!row.template_preference) return false;
  return true;
}

/**
 * True if at least one wizard field has been filled — used to show
 * "Resume" vs "Start" on the hub.
 */
export function isProfileInProgress(row: ArtistProfileRow | null): boolean {
  if (!row) return false;
  return Boolean(
    row.display_name ||
      row.bio ||
      row.city ||
      (row.disciplines && row.disciplines.length > 0)
  );
}

/**
 * True if the business workbook is substantially complete.
 */
export function isBusinessComplete(row: ArtistProfileRow | null): boolean {
  if (!row) return false;
  return Boolean(
    row.biz_entity_type &&
      row.biz_primary_revenue &&
      row.biz_primary_revenue.length > 0 &&
      row.biz_pricing_philosophy &&
      row.biz_fulfillment
  );
}

/**
 * True if the user has started the business workbook.
 */
export function isBusinessInProgress(row: ArtistProfileRow | null): boolean {
  if (!row) return false;
  return Boolean(
    row.biz_entity_type ||
      row.biz_entity_name ||
      (row.biz_primary_revenue && row.biz_primary_revenue.length > 0)
  );
}

export function profileToAnswers(
  row: ArtistProfileRow
): Partial<WizardAnswers> {
  return {
    displayName: row.display_name ?? "",
    pronouns: row.pronouns ?? "",
    city: row.city ?? "",
    bio: row.bio ?? "",
    photoUrl: row.photo_url ?? "",
    disciplines: row.disciplines as WizardAnswers["disciplines"],
    disciplinesOther: row.disciplines_other ?? "",
    experienceLevel:
      (row.experience_level as WizardAnswers["experienceLevel"]) ??
      ("starting_fresh" as WizardAnswers["experienceLevel"]),
    portfolioUrl: row.portfolio_url ?? "",
    audienceTypes: (row.audience_types ??
      []) as WizardAnswers["audienceTypes"],
    clientBase: (row.client_base ?? []) as WizardAnswers["clientBase"],
    audienceDescription: row.audience_description ?? "",
    goalsOptions: (row.goals_options ?? []) as WizardAnswers["goalsOptions"],
    goalsNote: row.goals_seeking ?? "",
    mutualAidMedia: row.mutual_aid_media,
    mutualAidAuthoring: row.mutual_aid_authoring,
    personalPhilosophy: row.personal_philosophy ?? "",
    aestheticKeywords: row.aesthetic_keywords ?? [],
    aestheticNotes: row.aesthetic_notes ?? "",
    needs: (row.needs ?? []) as WizardAnswers["needs"],
    needsNote: "",
    featuresRequested: (row.features_requested ??
      []) as WizardAnswers["featuresRequested"],
    featuresOther: row.features_other ?? "",
    templatePreference:
      (row.template_preference as WizardAnswers["templatePreference"]) ??
      ("article" as WizardAnswers["templatePreference"]),
    palettePreference: row.palette_preference ?? "",
  };
}
