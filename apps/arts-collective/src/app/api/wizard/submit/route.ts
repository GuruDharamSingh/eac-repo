import { NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { requireUser } from "@/lib/session";
import { wizardSchema } from "@/lib/schema";

export async function POST(req: Request) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = wizardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const a = parsed.data;

  const orgRows = await db<{ org_id: string }[]>`
    SELECT org_id FROM user_organizations
    WHERE user_id = ${user.id} AND role = 'owner'
    LIMIT 1
  `;
  const orgId = orgRows[0]?.org_id;
  if (!orgId) {
    return NextResponse.json(
      {
        error:
          "You don't have an org yet. Go back through the welcome flow to claim your subdomain.",
      },
      { status: 400 }
    );
  }

  try {
    await db.begin(async (tx) => {
      await tx`
        INSERT INTO artist_profiles (
          user_id, org_id,
          display_name, pronouns, city, bio, photo_url,
          disciplines, disciplines_other, experience_level,
          portfolio_url, audience_types, client_base, audience_description,
          goals_options, goals_seeking, mutual_aid_media, mutual_aid_authoring,
          personal_philosophy, aesthetic_keywords, aesthetic_notes,
          needs,
          features_requested, features_other,
          template_preference, palette_preference
        ) VALUES (
          ${user.id}, ${orgId},
          ${a.displayName}, ${a.pronouns || null}, ${a.city}, ${a.bio}, ${a.photoUrl || null},
          ${a.disciplines as unknown as string[]}, ${a.disciplinesOther || null}, ${a.experienceLevel},
          ${a.portfolioUrl || null}, ${a.audienceTypes as unknown as string[]}, ${a.clientBase as unknown as string[]}, ${a.audienceDescription || null},
          ${a.goalsOptions as unknown as string[]}, ${a.goalsNote || null}, ${a.mutualAidMedia}, ${a.mutualAidAuthoring},
          ${a.personalPhilosophy || null}, ${a.aestheticKeywords as unknown as string[]}, ${a.aestheticNotes || null},
          ${a.needs as unknown as string[]},
          ${a.featuresRequested as unknown as string[]}, ${a.featuresOther || null},
          ${a.templatePreference}, ${a.palettePreference || null}
        )
        ON CONFLICT (user_id) DO UPDATE SET
          display_name         = EXCLUDED.display_name,
          pronouns             = EXCLUDED.pronouns,
          city                 = EXCLUDED.city,
          bio                  = EXCLUDED.bio,
          photo_url            = EXCLUDED.photo_url,
          disciplines          = EXCLUDED.disciplines,
          disciplines_other    = EXCLUDED.disciplines_other,
          experience_level     = EXCLUDED.experience_level,
          portfolio_url        = EXCLUDED.portfolio_url,
          audience_types       = EXCLUDED.audience_types,
          client_base          = EXCLUDED.client_base,
          audience_description = EXCLUDED.audience_description,
          goals_options        = EXCLUDED.goals_options,
          goals_seeking        = EXCLUDED.goals_seeking,
          mutual_aid_media     = EXCLUDED.mutual_aid_media,
          mutual_aid_authoring = EXCLUDED.mutual_aid_authoring,
          personal_philosophy  = EXCLUDED.personal_philosophy,
          aesthetic_keywords   = EXCLUDED.aesthetic_keywords,
          aesthetic_notes      = EXCLUDED.aesthetic_notes,
          needs                = EXCLUDED.needs,
          features_requested   = EXCLUDED.features_requested,
          features_other       = EXCLUDED.features_other,
          template_preference  = EXCLUDED.template_preference,
          palette_preference   = EXCLUDED.palette_preference
      `;
    });
  } catch (err) {
    console.error("wizard submit failed", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Could not save your profile", detail: msg },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, slug: orgId });
}
