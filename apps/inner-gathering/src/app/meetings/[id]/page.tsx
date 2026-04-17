import { use } from 'react';
import { notFound } from 'next/navigation';
import { getMeetingById } from '@/lib/data';
import { getReplies } from '@elkdonis/db';
import { getServerSession } from '@elkdonis/auth-server';
import { GatheringDetails } from '@/components/gathering-details';

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

  const [replies, session] = use(
    Promise.all([
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
    <GatheringDetails
      gathering={meeting}
      type="meeting"
      replies={serializedReplies}
      currentUser={currentUser}
      isJoined={false} // Would need logic to check if user is RSVP'd
    />
  );
}
