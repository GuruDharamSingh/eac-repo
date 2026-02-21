import { use } from 'react';
import { notFound } from 'next/navigation';
import { getMeetingById, getEventPage } from '@/lib/data';
import { getServerSession } from '@elkdonis/auth-server';
import { DrawingPage } from '@/components/drawing-page';

export default function MeetingDrawingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const meeting = use(getMeetingById(id));

  if (!meeting) {
    notFound();
  }

  const [eventPage, session] = use(
    Promise.all([
      getEventPage(id),
      getServerSession(),
    ])
  );

  if (!eventPage?.drawing) {
    notFound();
  }

  return (
    <DrawingPage
      meeting={meeting}
      eventPage={eventPage}
    />
  );
}
