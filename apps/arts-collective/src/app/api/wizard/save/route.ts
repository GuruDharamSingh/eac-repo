import { NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { gainSpace } from "@elkdonis/services";
import { requireUser } from "@/lib/session";
import { z } from "zod";
import { wizardSchema, type WizardAnswers } from "@/lib/schema";

/**
 * Autosave endpoint for the artist profile wizard.
 *
 * The wizard autosaves while the artist types, so a draft routinely holds
 * values that are not valid yet (a one-letter name, half a URL). Each field is
 * checked against its own rule and only the fields that pass are written;
 * the rest stay in the browser draft until they are valid or the final submit
 * rejects them. Validating the body as a whole would fail the entire save on
 * one half-typed field, and writing unvalidated values would put them on a
 * completed artist's public page.
 */
const fieldSchemas = wizardSchema.shape as Record<string, z.ZodTypeAny>;

export async function POST(req: Request) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Expected an object" }, { status: 400 });
  }

  const a: Partial<WizardAnswers> = {};
  const skipped: string[] = [];
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    const schema = fieldSchemas[key];
    if (!schema || value === undefined) continue;
    const parsed = schema.safeParse(value);
    if (parsed.success) {
      (a as Record<string, unknown>)[key] = parsed.data;
    } else {
      skipped.push(key);
    }
  }


  // Build a SET clause dynamically — only columns the caller provided.
  const fields: Record<string, unknown> = {};
  const set = (col: string, val: unknown) => {
    if (val !== undefined) fields[col] = val;
  };
  // Empty string clears an optional column; an absent (or skipped) field
  // leaves it alone. `a.x || null` would turn "absent" into NULL.
  const orNull = (val: string | undefined) =>
    val === undefined ? undefined : val || null;

  set("display_name", a.displayName);
  set("pronouns", orNull(a.pronouns));
  set("city", a.city);
  set("bio", a.bio);
  set("photo_url", orNull(a.photoUrl));
  set("disciplines", a.disciplines);
  set("disciplines_other", orNull(a.disciplinesOther));
  set("experience_level", a.experienceLevel);
  set("portfolio_url", orNull(a.portfolioUrl));
  set("audience_types", a.audienceTypes);
  set("client_base", a.clientBase);
  set("audience_description", orNull(a.audienceDescription));
  set("goals_options", a.goalsOptions);
  set("goals_seeking", orNull(a.goalsNote));
  set("mutual_aid_media", a.mutualAidMedia);
  set("mutual_aid_authoring", a.mutualAidAuthoring);
  set("personal_philosophy", orNull(a.personalPhilosophy));
  set("aesthetic_keywords", a.aestheticKeywords);
  set("aesthetic_notes", orNull(a.aestheticNotes));
  set("needs", a.needs);
  set("features_requested", a.featuresRequested);
  set("features_other", orNull(a.featuresOther));
  set("template_preference", a.templatePreference);
  set("palette_preference", orNull(a.palettePreference));

  const keys = Object.keys(fields);
  if (keys.length === 0) {
    return NextResponse.json({ ok: true, noChanges: true, skipped });
  }

  try {
    // The row normally exists (the wizard page gained the space). Guard for
    // a save arriving first: gainSpace files it under the person's own org,
    // else oad — no owned org is required.
    const [existing] = await db<{ user_id: string }[]>`
      SELECT user_id FROM artist_profiles WHERE user_id = ${user.id}
    `;
    if (!existing) await gainSpace(user.id);

    // Build a parameterized UPDATE. postgres.js lets us pass a plain object.
    await db`
      UPDATE artist_profiles SET ${db(fields)}
      WHERE user_id = ${user.id}
    `;
  } catch (err) {
    console.error("wizard save failed", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Could not save progress", detail: msg },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, skipped });
}
