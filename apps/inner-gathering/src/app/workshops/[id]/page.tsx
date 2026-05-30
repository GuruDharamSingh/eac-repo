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
        wp.promo_video_url,
        t.metadata,
        t.created_at,
        t.published_at
      FROM threads t
      LEFT JOIN users u ON u.id = t.author_id
      LEFT JOIN organizations o ON o.id = t.org_id
      LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
      WHERE t.id = ${id}
        AND t.kind = 'workshop'
        AND t.org_id = 'inner_group'
      LIMIT 1
    `;

    if (rows.length === 0) return null;
    const row = rows[0];

    const meta = (row.metadata as Record<string, unknown>) ?? {};
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      coverImage: row.cover_image_url ? { url: row.cover_image_url } : undefined,
      guide: {
        displayName: row.guide_display_name ?? 'Guide',
        avatarUrl: row.guide_avatar_url ?? undefined,
      },
      organization: { name: row.org_name ?? 'InnerGathering' },
      price: row.price ?? undefined,
      nextcloudTalkToken: (meta.nextcloudTalkToken as string) ?? undefined,
      sessions: (meta.sessions as object[]) ?? [],
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

  // Enrolled = logged-in member of inner_group org
  let isEnrolled = false;
  if (session?.user) {
    const membership = await db`
      SELECT 1 FROM user_organizations
      WHERE user_id = ${session.user.id}
        AND org_id = 'inner_group'
      LIMIT 1
    `.catch(() => []);
    isEnrolled = membership.length > 0;
  }

  const serializedReplies = JSON.parse(JSON.stringify(replies));

  return (
    <WorkshopPage
      workshop={workshop}
      currentUser={currentUser}
      isEnrolled={isEnrolled}
      replies={serializedReplies}
    />
  );
}
