"use server";

import { redirect } from "next/navigation";
import { db } from "@elkdonis/db";
import { requireUser } from "@/lib/session";

export async function startOverAction() {
  const user = await requireUser();

  // Keep the org + ownership + artist_profile row; just clear the wizard
  // fields so the user walks through onboarding again.
  await db`
    UPDATE artist_profiles SET
      display_name         = NULL,
      pronouns             = NULL,
      city                 = NULL,
      bio                  = NULL,
      photo_url            = NULL,
      disciplines          = '{}'::text[],
      disciplines_other    = NULL,
      experience_level     = NULL,
      portfolio_url        = NULL,
      audience_types       = '{}'::text[],
      client_base          = '{}'::text[],
      audience_description = NULL,
      audience_value       = NULL,
      goals_options        = '{}'::text[],
      goals_seeking        = NULL,
      goals_offering       = NULL,
      mutual_aid_media     = false,
      mutual_aid_authoring = false,
      personal_philosophy  = NULL,
      aesthetic_keywords   = '{}'::text[],
      aesthetic_notes      = NULL,
      needs                = '{}'::text[],
      features_requested   = '{}'::text[],
      features_other       = NULL,
      template_preference  = NULL,
      palette_preference   = NULL
    WHERE user_id = ${user.id}
  `;

  redirect("/wizard");
}
