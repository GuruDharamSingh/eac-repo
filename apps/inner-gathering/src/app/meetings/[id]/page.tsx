import { use } from 'react';
import { notFound } from 'next/navigation';
import { getMeetingById, getEventPage } from '@/lib/data';
import { getReplies } from '@elkdonis/db';
import { getServerSession } from '@elkdonis/auth-server';
import { EventPageView } from '@/components/event-page-view';

export default function MeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const meeting = use(getMeetingById(id));

  if (!meeting) {
    notFound();
  }

  const [eventPage, replies, session] = use(
    Promise.all([
      getEventPage(id),
      getReplies(id, 'meeting', 'oldest'),
      getServerSession(),
    ])
  );

  // Serialize dates for client components
  const serializedReplies = JSON.parse(JSON.stringify(replies));

  const currentUser = session?.user
    ? {
        id: session.user.id,
        displayName: session.user.email?.split('@')[0] ?? null,
        initials: session.user.email?.substring(0, 2).toUpperCase() ?? null,
      }
    : null;

  return (
    <EventPageView
      meeting={meeting}
      eventPage={eventPage}
      replies={serializedReplies}
      currentUser={currentUser}
    />
  );
}
