import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';
import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Must be the author, or an owner/guide of the workshop's org
  const [thread] = await db`
    SELECT author_id, org_id FROM threads
    WHERE id = ${id} AND kind = 'workshop'
    LIMIT 1
  `;
  if (!thread) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [membership] = await db`
    SELECT role FROM user_organizations
    WHERE user_id = ${session.user.id} AND org_id = ${thread.org_id}
    LIMIT 1
  `;
  const isAuthor = thread.author_id === session.user.id;
  const canModerate = membership?.role === 'owner' || membership?.role === 'guide';
  if (!isAuthor && !canModerate) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const {
    title,
    description,
    price,
    coverImageUrl,
    bannerImageUrl,
    heroMediaUrl,
    heroMediaType,
    nextcloudTalkToken,
    sessions,
    status,
  } = body;

  if (heroMediaType !== undefined && heroMediaType !== null && !['image', 'video'].includes(heroMediaType)) {
    return NextResponse.json({ error: 'heroMediaType must be image or video' }, { status: 400 });
  }

  await db`
    UPDATE threads SET
      title                = COALESCE(${title ?? null}, title),
      body                 = COALESCE(${description ?? null}, body),
      status               = COALESCE(${status ?? null}, status),
      nextcloud_talk_token = COALESCE(${nextcloudTalkToken ?? null}, nextcloud_talk_token),
      updated_at           = NOW()
    WHERE id = ${id}
  `;

  try {
    await db`
      INSERT INTO workshop_pages (
        thread_id, cover_image_url, banner_image_url,
        hero_media_url, hero_media_type, price_member
      )
      VALUES (
        ${id}, ${coverImageUrl ?? null}, ${bannerImageUrl ?? null},
        ${heroMediaUrl ?? null}, ${heroMediaType ?? null},
        ${price != null ? String(price) : null}
      )
      ON CONFLICT (thread_id) DO UPDATE
        SET cover_image_url  = COALESCE(EXCLUDED.cover_image_url,  workshop_pages.cover_image_url),
            banner_image_url = COALESCE(EXCLUDED.banner_image_url, workshop_pages.banner_image_url),
            hero_media_url   = COALESCE(EXCLUDED.hero_media_url,   workshop_pages.hero_media_url),
            hero_media_type  = COALESCE(EXCLUDED.hero_media_type,  workshop_pages.hero_media_type),
            price_member     = COALESCE(EXCLUDED.price_member,     workshop_pages.price_member),
            updated_at       = NOW()
    `;
  } catch {
    // workshop_pages may not be migrated yet
  }

  // Sessions live in workshop_sessions — same table /api/content writes, so
  // sessions added via either the Content Form or this deep editor show up
  // in both places. Replace wholesale, matching /api/content's approach.
  if (sessions !== undefined) {
    await db`DELETE FROM workshop_sessions WHERE thread_id = ${id}`;
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      await db`
        INSERT INTO workshop_sessions ${db({
          id: `ws_${nanoid(16)}`,
          thread_id: id,
          session_number: i + 1,
          topic: s.title,
          scheduled_at: s.scheduledAt ? new Date(s.scheduledAt) : null,
          duration_minutes: s.durationMinutes ?? null,
          notes: JSON.stringify({
            description: s.description ?? '',
            isOnline: s.isOnline ?? true,
            location: s.location ?? '',
            videoConferenceUrl: s.videoConferenceUrl ?? '',
            mediaUrl: s.mediaUrl ?? null,
          }),
        })}
      `;
    }
  }

  return NextResponse.json({ workshop: { id } });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rows = await db`
    SELECT
      t.id, t.title, t.body AS description, t.status,
      t.nextcloud_talk_token,
      wp.cover_image_url,
      wp.banner_image_url,
      wp.hero_media_url,
      wp.hero_media_type,
      wp.price_member AS price
    FROM threads t
    LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
    WHERE t.id = ${id} AND t.kind = 'workshop'
    LIMIT 1
  `.catch(() => []);

  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const row = rows[0];

  const sessionRows = await db`
    SELECT id, session_number, topic, scheduled_at, duration_minutes, notes
    FROM workshop_sessions
    WHERE thread_id = ${id}
    ORDER BY session_number ASC
  `.catch(() => []);

  return NextResponse.json({
    workshop: {
      id: row.id,
      title: row.title,
      description: row.description ?? '',
      status: row.status,
      coverImageUrl: row.cover_image_url ?? '',
      bannerImageUrl: row.banner_image_url ?? '',
      heroMediaUrl: row.hero_media_url ?? '',
      heroMediaType: row.hero_media_type ?? null,
      price: row.price ?? 0,
      nextcloudTalkToken: row.nextcloud_talk_token ?? '',
      sessions: sessionRows.map((s: any) => ({
        _key: s.id,
        title: s.topic ?? '',
        description: s.notes?.description ?? '',
        scheduledAt: s.scheduled_at ? new Date(s.scheduled_at).toISOString().slice(0, 16) : '',
        durationMinutes: s.duration_minutes ?? 90,
        isOnline: s.notes?.isOnline ?? true,
        location: s.notes?.location ?? '',
        videoConferenceUrl: s.notes?.videoConferenceUrl ?? '',
        mediaUrl: s.notes?.mediaUrl ?? null,
        orderIndex: s.session_number - 1,
      })),
    },
  });
}
