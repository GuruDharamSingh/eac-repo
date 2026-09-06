import { notFound, redirect } from 'next/navigation';
import { getServerSession, isAdmin } from '@elkdonis/auth-server';
import { db } from '@elkdonis/db';
import { WorkshopCreatePage } from '@/components/workshop-create-page';
import {
  RSVP_GUEST_TEMPLATE_KEY,
  getEmailTemplateSettings,
  threadTemplateKey,
} from '@/lib/email-template-settings';
import { REMINDER_TEMPLATE_KEY } from '@/lib/reminders';
import { parseSessionNotes } from '@/lib/workshop-session-notes';

async function loadWorkshopDraft(id: string, userId: string) {
  const [thread] = await db`
    SELECT id, kind, org_id, author_id, title, body, reminder_minutes_before,
           attendee_limit, rsvp_deadline, min_attendees
    FROM threads
    WHERE id = ${id} AND kind = 'workshop'
    LIMIT 1
  `;
  if (!thread) return null;

  const admin = await isAdmin(userId);
  if (thread.author_id !== userId && !admin) return 'forbidden' as const;

  const [page] = await db`
    SELECT description_short, price_member, cover_image_url,
           banner_image_url, banner_focal_y, hero_media_url, hero_media_type, hero_text, background_color
    FROM workshop_pages WHERE thread_id = ${id}
  `;

  const [rsvpTemplate, reminderTemplate] = await Promise.all([
    getEmailTemplateSettings(thread.org_id, threadTemplateKey(RSVP_GUEST_TEMPLATE_KEY, id)).catch(() => null),
    getEmailTemplateSettings(thread.org_id, threadTemplateKey(REMINDER_TEMPLATE_KEY, id)).catch(() => null),
  ]);

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
      bannerImageUrl: (page?.banner_image_url as string) ?? null,
      bannerFocalY: page?.banner_focal_y != null ? Number(page.banner_focal_y) : null,
      heroMediaUrl: (page?.hero_media_url as string) ?? null,
      heroMediaType: (page?.hero_media_type as 'image' | 'video' | null) ?? null,
      heroText: (page?.hero_text as string) ?? null,
      backgroundColor: (page?.background_color as string) ?? null,
      reminderMinutesBefore: (thread.reminder_minutes_before as number) ?? 60,
      rsvpEmailBody: rsvpTemplate?.config.bodyText ?? null,
      reminderEmailBody: reminderTemplate?.config.bodyText ?? null,
      isRsvpEnabled: true,
      attendeeLimit: thread.attendee_limit != null ? Number(thread.attendee_limit) : null,
      rsvpDeadline: thread.rsvp_deadline ? new Date(thread.rsvp_deadline).toISOString() : null,
      minAttendees: thread.min_attendees != null ? Number(thread.min_attendees) : null,
      sessions: sessionRows.map((s: any) => {
        const notes = parseSessionNotes(s.notes);
        return {
          id: s.id,
          title: s.topic ?? '',
          description: notes.description ?? '',
          scheduledAt: s.scheduled_at ? new Date(s.scheduled_at).toISOString() : undefined,
          durationMinutes: s.duration_minutes ?? undefined,
          isOnline: notes.isOnline ?? true,
          location: notes.location ?? '',
          videoConferenceUrl: notes.videoConferenceUrl ?? '',
          mediaUrl: notes.mediaUrl ?? null,
          videoUrl: notes.videoUrl ?? null,
          resources: notes.resources ?? [],
          backgroundColor: notes.backgroundColor ?? null,
          orderIndex: (s.session_number ?? 1) - 1,
        };
      }),
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
