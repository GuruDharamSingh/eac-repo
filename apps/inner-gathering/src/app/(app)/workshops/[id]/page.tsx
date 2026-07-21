import { notFound } from 'next/navigation';
import { getServerSession } from '@elkdonis/auth-server';
import { getReplies, db } from '@elkdonis/db';
import { WorkshopPage } from '@/components/workshop-page';

async function getWorkshop(id: string) {
  // Try threads table first (migration 030+); fall back to mock for dev
  try {
    const rows = await db`
      SELECT
        t.id,
        t.title,
        t.body        AS description,
        t.author_id   AS guide_id,
        t.org_id,
        t.status,
        t.visibility,
        t.nextcloud_talk_token,
        u.display_name AS guide_display_name,
        u.avatar_url   AS guide_avatar_url,
        o.name         AS org_name,
        wp.subtitle,
        wp.description_short,
        wp.discipline,
        wp.level,
        wp.price_member                AS price,
        wp.session_count,
        wp.cover_image_url,
        wp.banner_image_url,
        wp.hero_media_url,
        wp.hero_media_type,
        wp.promo_video_url,
        t.created_at,
        t.published_at
      FROM threads t
      LEFT JOIN users u ON u.id = t.author_id
      LEFT JOIN organizations o ON o.id = t.org_id
      LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
      WHERE t.id = ${id}
        AND t.kind = 'workshop'
      LIMIT 1
    `;

    if (rows.length === 0) return null;
    const row = rows[0];

    // Sessions live in workshop_sessions — shared with /api/workshops and the
    // Content Form, so sessions added via either path show up here.
    const sessionRows = await db`
      SELECT id, session_number, topic, scheduled_at, duration_minutes, notes
      FROM workshop_sessions
      WHERE thread_id = ${id}
      ORDER BY session_number ASC
    `.catch(() => []);

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      guideId: row.guide_id as string,
      orgId: row.org_id as string,
      coverImage: row.cover_image_url ? { url: row.cover_image_url } : undefined,
      bannerImageUrl: (row.banner_image_url as string) ?? null,
      heroMediaUrl: (row.hero_media_url as string) ?? null,
      heroMediaType: (row.hero_media_type as 'image' | 'video' | null) ?? null,
      guide: {
        displayName: row.guide_display_name ?? 'Guide',
        avatarUrl: row.guide_avatar_url ?? undefined,
      },
      organization: { name: row.org_name ?? 'InnerGathering' },
      price: row.price ?? undefined,
      nextcloudTalkToken: (row.nextcloud_talk_token as string) ?? undefined,
      sessions: sessionRows.map((s: any) => ({
        id: s.id,
        title: s.topic ?? '',
        description: s.notes?.description ?? '',
        scheduledAt: s.scheduled_at ? new Date(s.scheduled_at).toISOString() : new Date().toISOString(),
        durationMinutes: s.duration_minutes ?? 90,
        isOnline: s.notes?.isOnline ?? true,
        location: s.notes?.location ?? '',
        videoConferenceUrl: s.notes?.videoConferenceUrl ?? '',
        mediaUrl: s.notes?.mediaUrl ?? null,
        orderIndex: s.session_number - 1,
      })),
    };
  } catch {
    // DB not migrated yet — return null so the page 404s cleanly
    return null;
  }
}

export default async function WorkshopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [workshop, session, replies] = await Promise.all([
    getWorkshop(id),
    getServerSession(),
    getReplies(id, 'workshop', 'oldest').catch(() => []),
  ]);

  if (!workshop) notFound();

  const currentUser = session?.user
    ? {
        id: session.user.id,
        displayName: session.user.email?.split('@')[0] ?? null,
        initials: session.user.email?.substring(0, 2).toUpperCase() ?? null,
      }
    : null;

  // Enrolled = RSVP'd yes or has a paid join request. Owner = the author.
  const isOwner = Boolean(session?.user && workshop.guideId === session.user.id);
  let isEnrolled = false;
  if (session?.user && !isOwner) {
    const enrolment = await db`
      SELECT 1 FROM thread_rsvps
      WHERE thread_id = ${id} AND user_id = ${session.user.id} AND status = 'yes'
      UNION ALL
      SELECT 1 FROM workshop_join_requests
      WHERE workshop_id = ${id} AND user_id = ${session.user.id} AND status = 'paid'
      LIMIT 1
    `.catch(() => []);
    isEnrolled = enrolment.length > 0;
  }

  const serializedReplies = JSON.parse(JSON.stringify(replies));

  return (
    <WorkshopPage
      workshop={workshop}
      currentUser={currentUser}
      isEnrolled={isEnrolled || isOwner}
      isOwner={isOwner}
      replies={serializedReplies}
    />
  );
}
