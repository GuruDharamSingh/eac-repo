import { notFound } from 'next/navigation';
import { Container, Stack, Title, Text, Paper, Group, Badge, Button, Divider } from '@mantine/core';
import { IconCalendar, IconMapPin, IconClock, IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { getMeeting } from '@/lib/data';
import { RsvpForm } from '@elkdonis/ui';

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meeting = await getMeeting(id);

  if (!meeting) notFound();

  const date = meeting.scheduled_at ? new Date(meeting.scheduled_at) : null;

  return (
    <Container size="sm" py="xl">
      <Stack gap="xl">
        <Button
          component={Link}
          href="/meetings"
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          style={{ color: '#8d6708', alignSelf: 'flex-start' }}
        >
          All Gatherings
        </Button>

        <Paper
          p="xl"
          style={{
            background: 'linear-gradient(135deg, #fffde7 0%, #fdf5e6 100%)',
            border: '1px solid rgba(244, 196, 48, 0.5)',
            boxShadow: '0 4px 24px rgba(180, 100, 20, 0.12)',
          }}
        >
          <Stack gap="lg">
            <Badge
              size="md"
              style={{
                background: 'linear-gradient(90deg, #f4c430, #e6b422)',
                color: '#36454f',
                fontFamily: "'Cinzel', serif",
                alignSelf: 'flex-start',
              }}
            >
              Amrit Vela Sadhana
            </Badge>

            <Title
              order={1}
              style={{
                fontFamily: "'Cinzel', serif",
                color: '#36454f',
                fontSize: 'clamp(1.3rem, 4vw, 1.8rem)',
              }}
            >
              {meeting.title}
            </Title>

            <Divider color="rgba(244, 196, 48, 0.4)" />

            <Stack gap="sm">
              {date && (
                <Group gap="sm">
                  <IconCalendar size={20} color="#e6b422" />
                  <Text c="dark.6">{format(date, 'EEEE, MMMM d, yyyy')}</Text>
                </Group>
              )}
              {date && (
                <Group gap="sm">
                  <IconClock size={20} color="#e6b422" />
                  <Text c="dark.6">
                    {format(date, 'h:mm a')} ·{' '}
                    {meeting.duration_minutes
                      ? `${meeting.duration_minutes} minutes`
                      : '2.5 hours'}
                  </Text>
                </Group>
              )}
              {meeting.location && (
                <Group gap="sm">
                  <IconMapPin size={20} color="#e6b422" />
                  <Text c="dark.6">{meeting.location}</Text>
                </Group>
              )}
            </Stack>

            {meeting.description && (
              <>
                <Divider color="rgba(244, 196, 48, 0.25)" />
                <Text size="md" c="dark.6" style={{ lineHeight: 1.8 }}>
                  {meeting.description}
                </Text>
              </>
            )}

            <Divider color="rgba(244, 196, 48, 0.25)" />

            <RsvpForm
              meetingId={meeting.id}
              meetingTitle={meeting.title}
              apiPath="/api/rsvp"
            />
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
