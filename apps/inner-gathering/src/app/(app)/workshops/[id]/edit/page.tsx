import { notFound, redirect } from 'next/navigation';
import { getServerSession, isAdmin } from '@elkdonis/auth-server';
import { db } from '@elkdonis/db';
import { WorkshopCreatePage } from '@/components/workshop-create-page';

async function loadWorkshopDraft(id: string, userId: string) {
  const [thread] = await db`
    SELECT id, kind, org_id, author_id, title, body
    FROM threads
    WHERE id = ${id} AND kind = 'workshop'
    LIMIT 1
  `;
  if (!thread) return null;

  const admin = await isAdmin(userId);
  if (thread.author_id !== userId && !admin) return 'forbidden' as const;

  const [page] = await db`
    SELECT description_short, price_member, cover_image_url
    FROM workshop_pages WHERE thread_id = ${id}
  `;

  const sessionRows = await db`
    SELECT id, session_number, topic, scheduled_at, duration_minutes, notes
    FROM workshop_sessions
    WHERE thread_id = ${id}
    ORDER BY session_number
  `;

  return {
    orgId: thread.org_id as string,
    draft: {
      title: thread.title as string,
      body: (thread.body as string) ?? '',
      isMeeting: true,
      primaryOrgId: thread.org_id as string,
      pitch: (page?.description_short as string) ?? null,
      price: page?.price_member != null ? Number(page.price_member) : null,
      flyerUrl: (page?.cover_image_url as string) ?? null,
      sessions: sessionRows.map((s: any) => ({
        id: s.id,
        title: s.topic ?? '',
        description: s.notes?.description ?? '',
        scheduledAt: s.scheduled_at ? new Date(s.scheduled_at).toISOString() : undefined,
        durationMinutes: s.duration_minutes ?? undefined,
        isOnline: s.notes?.isOnline ?? true,
        location: s.notes?.location ?? '',
        videoConferenceUrl: s.notes?.videoConferenceUrl ?? '',
        mediaUrl: s.notes?.mediaUrl ?? null,
        orderIndex: (s.session_number ?? 1) - 1,
      })),
    },
  };
}

export default async function EditWorkshopPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user) redirect(`/login?returnTo=/workshops/${id}/edit`);

  const result = await loadWorkshopDraft(id, session.user.id);
  if (result === null) notFound();
  if (result === 'forbidden') redirect(`/workshops/${id}`);

  return (
    <WorkshopCreatePage
      orgId={result.orgId}
      userId={session.user.id}
      initialThreadId={id}
      initialDraft={result.draft}
    />
  );
}
