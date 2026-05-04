import { NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { requireUser } from "@/lib/session";
import { wizardSchema } from "@/lib/schema";

const partialSchema = wizardSchema.partial();

export async function POST(req: Request) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = partialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const a = parsed.data;

  const orgRows = await db<{ org_id: string }[]>`
    SELECT org_id FROM user_organizations
    WHERE user_id = ${user.id} AND role = 'owner' LIMIT 1
  `;
  const orgId = orgRows[0]?.org_id;
  if (!orgId) {
    return NextResponse.json({ error: "No org" }, { status: 400 });
  }

  // Build a SET clause dynamically — only columns the caller provided.
  const fields: Record<string, unknown> = {};
  const set = (col: string, val: unknown) => {
    if (val !== undefined) fields[col] = val;
  };

  set("display_name", a.displayName);
  set("pronouns", a.pronouns || null);
  set("city", a.city);
  set("bio", a.bio);
  set("photo_url", a.photoUrl || null);
  set("disciplines", a.disciplines);
  set("disciplines_other", a.disciplinesOther || null);
  set("experience_level", a.experienceLevel);
  set("portfolio_url", a.portfolioUrl || null);
  set("audience_types", a.audienceTypes);
  set("client_base", a.clientBase);
  set("audience_description", a.audienceDescription || null);
  set("goals_options", a.goalsOptions);
  set("goals_seeking", a.goalsNote || null);
  set("mutual_aid_media", a.mutualAidMedia);
  set("mutual_aid_authoring", a.mutualAidAuthoring);
  set("personal_philosophy", a.personalPhilosophy || null);
  set("aesthetic_keywords", a.aestheticKeywords);
  set("aesthetic_notes", a.aestheticNotes || null);
  set("needs", a.needs);
  set("features_requested", a.featuresRequested);
  set("features_other", a.featuresOther || null);
  set("template_preference", a.templatePreference);
  set("palette_preference", a.palettePreference || null);

  const keys = Object.keys(fields);
  if (keys.length === 0) {
    return NextResponse.json({ ok: true, noChanges: true });
  }

  try {
    // Ensure the row exists (owner-signup creates one, but guard anyway).
    await db`
      INSERT INTO artist_profiles (user_id, org_id)
      VALUES (${user.id}, ${orgId})
      ON CONFLICT (user_id) DO NOTHING
    `;

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

  return NextResponse.json({ ok: true });
}
