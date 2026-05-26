import { NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';
import { db } from '@elkdonis/db';

export async function GET() {
  const session = await getServerSession();
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [row] = await db`
    SELECT
      user_id, org_id, display_name, city, bio, photo_url,
      disciplines, portfolio_url, experience_level,
      personal_philosophy, aesthetic_notes, aesthetic_keywords,
      audience_description, audience_value, audience_types, client_base,
      goals_seeking, goals_offering, goals_options,
      mutual_aid_media, mutual_aid_authoring, needs,
      template_preference, features_other,
      social_links,
      is_stub, created_at, updated_at
    FROM artist_profiles
    WHERE user_id = ${session.user.id}
    LIMIT 1
  `;

  return NextResponse.json({ profile: row ?? null });
}

export async function PATCH(req: Request) {
  const session = await getServerSession();
  if (!session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    displayName,
    photoUrl,
    personalPhilosophy,
    portfolioUrl,
    socialLinks,
    // legacy full-form fields (still accepted so old saves don't break)
    city, bio, disciplines, experienceLevel,
    aestheticNotes, aestheticKeywords,
    audienceDescription, audienceValue, audienceTypes, clientBase,
    goalsSeeking, goalsOffering, goalsOptions,
    mutualAidMedia, mutualAidAuthoring, needs,
    templatePreference, featuresOther,
  } = body;

  const cleanArr = (val: unknown, max = 20) =>
    Array.isArray(val)
      ? db.array(val.filter((d: unknown) => typeof d === 'string').slice(0, max))
      : undefined;

  const cleanDisciplines   = cleanArr(disciplines, 10);
  const cleanAudienceTypes = cleanArr(audienceTypes);
  const cleanClientBase    = cleanArr(clientBase);
  const cleanKeywords      = cleanArr(aestheticKeywords);
  const cleanGoalsOptions  = cleanArr(goalsOptions);
  const cleanNeeds         = cleanArr(needs);

  const validExp  = ['starting_fresh', 'established'];
  const cleanExp  = validExp.includes(experienceLevel) ? experienceLevel : null;
  const validTmpl = ['article', 'event', 'radio', 'business'];
  const cleanTmpl = validTmpl.includes(templatePreference) ? templatePreference : null;

  // Validate social_links shape: array of {label, url}
  const cleanSocialLinks: Array<{ label: string; url: string }> | undefined =
    Array.isArray(socialLinks)
      ? socialLinks
          .filter((l: unknown) => l && typeof l === 'object')
          .slice(0, 20)
          .map((l: { label?: unknown; url?: unknown }) => ({
            label: typeof l.label === 'string' ? l.label.slice(0, 80) : '',
            url: typeof l.url === 'string' ? l.url.slice(0, 300) : '',
          }))
      : undefined;

  const [updated] = await db`
    INSERT INTO artist_profiles (
      user_id, org_id,
      display_name, city, bio, photo_url,
      disciplines, portfolio_url, experience_level,
      personal_philosophy, aesthetic_notes, aesthetic_keywords,
      audience_description, audience_value, audience_types, client_base,
      goals_seeking, goals_offering, goals_options,
      mutual_aid_media, mutual_aid_authoring, needs,
      template_preference, features_other,
      social_links,
      is_stub
    ) VALUES (
      ${session.user.id}, 'inner_group',
      ${displayName ?? null},
      ${city ?? null},
      ${bio ?? null},
      ${photoUrl ?? null},
      ${cleanDisciplines ?? db.array([])},
      ${portfolioUrl ?? null},
      ${cleanExp},
      ${personalPhilosophy ?? null},
      ${aestheticNotes ?? null},
      ${cleanKeywords ?? db.array([])},
      ${audienceDescription ?? null},
      ${audienceValue ?? null},
      ${cleanAudienceTypes ?? db.array([])},
      ${cleanClientBase ?? db.array([])},
      ${goalsSeeking ?? null},
      ${goalsOffering ?? null},
      ${cleanGoalsOptions ?? db.array([])},
      ${mutualAidMedia ?? false},
      ${mutualAidAuthoring ?? false},
      ${cleanNeeds ?? db.array([])},
      ${cleanTmpl},
      ${featuresOther ?? null},
      ${db.json(cleanSocialLinks ?? [])},
      false
    )
    ON CONFLICT (user_id) DO UPDATE SET
      display_name         = COALESCE(EXCLUDED.display_name,         artist_profiles.display_name),
      city                 = COALESCE(EXCLUDED.city,                 artist_profiles.city),
      bio                  = COALESCE(EXCLUDED.bio,                  artist_profiles.bio),
      photo_url            = COALESCE(EXCLUDED.photo_url,            artist_profiles.photo_url),
      disciplines          = CASE WHEN ${cleanDisciplines !== undefined}   THEN EXCLUDED.disciplines          ELSE artist_profiles.disciplines          END,
      portfolio_url        = COALESCE(EXCLUDED.portfolio_url,        artist_profiles.portfolio_url),
      experience_level     = COALESCE(EXCLUDED.experience_level,     artist_profiles.experience_level),
      personal_philosophy  = COALESCE(EXCLUDED.personal_philosophy,  artist_profiles.personal_philosophy),
      aesthetic_notes      = COALESCE(EXCLUDED.aesthetic_notes,      artist_profiles.aesthetic_notes),
      aesthetic_keywords   = CASE WHEN ${cleanKeywords !== undefined}      THEN EXCLUDED.aesthetic_keywords   ELSE artist_profiles.aesthetic_keywords   END,
      audience_description = COALESCE(EXCLUDED.audience_description, artist_profiles.audience_description),
      audience_value       = COALESCE(EXCLUDED.audience_value,       artist_profiles.audience_value),
      audience_types       = CASE WHEN ${cleanAudienceTypes !== undefined} THEN EXCLUDED.audience_types       ELSE artist_profiles.audience_types       END,
      client_base          = CASE WHEN ${cleanClientBase !== undefined}    THEN EXCLUDED.client_base          ELSE artist_profiles.client_base          END,
      goals_seeking        = COALESCE(EXCLUDED.goals_seeking,        artist_profiles.goals_seeking),
      goals_offering       = COALESCE(EXCLUDED.goals_offering,       artist_profiles.goals_offering),
      goals_options        = CASE WHEN ${cleanGoalsOptions !== undefined}  THEN EXCLUDED.goals_options        ELSE artist_profiles.goals_options        END,
      mutual_aid_media     = EXCLUDED.mutual_aid_media,
      mutual_aid_authoring = EXCLUDED.mutual_aid_authoring,
      needs                = CASE WHEN ${cleanNeeds !== undefined}         THEN EXCLUDED.needs                ELSE artist_profiles.needs                END,
      template_preference  = COALESCE(EXCLUDED.template_preference,  artist_profiles.template_preference),
      features_other       = COALESCE(EXCLUDED.features_other,       artist_profiles.features_other),
      social_links         = CASE WHEN ${Array.isArray(socialLinks)} THEN EXCLUDED.social_links ELSE artist_profiles.social_links END,
      is_stub              = false,
      updated_at           = NOW()
    RETURNING
      user_id, display_name, city, photo_url, portfolio_url, social_links, is_stub
  `;

  // Mirror display_name and avatar to users table
  if (displayName) {
    await db`UPDATE users SET display_name = ${displayName}, updated_at = NOW() WHERE id = ${session.user.id}`;
  }
  if (photoUrl) {
    await db`UPDATE users SET avatar_url = ${photoUrl}, updated_at = NOW() WHERE id = ${session.user.id}`;
  }

  return NextResponse.json({ profile: updated });
}
