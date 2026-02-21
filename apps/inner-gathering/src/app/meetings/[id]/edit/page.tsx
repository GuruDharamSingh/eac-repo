import { use } from 'react';
import { notFound } from 'next/navigation';
import { getMeetingById, getEventPage } from '@/lib/data';
import { EventPageEditor } from '@/components/event-page-editor';

export default function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const meeting = use(getMeetingById(id));

  if (!meeting) {
    notFound();
  }

  const eventPage = use(getEventPage(id));

  return <EventPageEditor meeting={meeting} eventPage={eventPage} />;
}
