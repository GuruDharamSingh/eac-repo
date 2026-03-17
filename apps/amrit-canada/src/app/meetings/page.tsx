import { Container, Stack, Title, Text } from '@mantine/core';
import { MeetingListItem } from '@/components/meeting-list-item';
import { getUpcomingMeetings } from '@/lib/data';

export const metadata = {
  title: 'Gatherings | Amrit Vela Toronto',
};

export default async function MeetingsPage() {
  const meetings = await getUpcomingMeetings(20);

  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        <Stack gap="xs">
          <Title
            order={1}
            style={{ fontFamily: "'Cinzel', serif", color: '#36454f', fontSize: '1.8rem' }}
          >
            Upcoming Gatherings
          </Title>
          <Text c="dimmed" size="md" style={{ fontStyle: 'italic' }}>
            Monthly early morning sadhana sessions in Toronto
          </Text>
        </Stack>

        <hr className="saffron-divider" />

        {meetings.length === 0 ? (
          <Stack align="center" gap="sm" py="xl">
            <Text size="lg" c="dimmed" ta="center" style={{ fontStyle: 'italic' }}>
              No upcoming gatherings scheduled yet.
            </Text>
            <Text size="sm" c="dimmed" ta="center">
              Gatherings are announced monthly — check back soon.
            </Text>
          </Stack>
        ) : (
          <Stack gap="md">
            {meetings.map((m) => (
              <MeetingListItem key={m.id} meeting={m} />
            ))}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
