import { NextResponse } from 'next/server';
import { db } from '@elkdonis/db';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  const [row] = await db`
    SELECT
      ap.user_id,
      ap.display_name,
      ap.city,
      ap.bio,
      ap.photo_url,
      ap.disciplines,
      ap.portfolio_url,
      ap.experience_level,
      ap.personal_philosophy,
      ap.aesthetic_notes,
      ap.aesthetic_keywords,
      ap.audience_description,
      ap.goals_seeking,
      ap.goals_offering,
      ap.goals_options,
      ap.mutual_aid_media,
      ap.mutual_aid_authoring,
      ap.needs,
      ap.is_stub,
      ap.created_at
    FROM artist_profiles ap
    WHERE ap.user_id = ${userId}
      AND ap.is_stub = false
    LIMIT 1
  `;

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ profile: row });
}
