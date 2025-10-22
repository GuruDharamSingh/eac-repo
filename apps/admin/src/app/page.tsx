import { getMeetings } from "@/lib/data";
import { MeetingCard } from "@/components/meeting-card";
import { Calendar } from "lucide-react";
import { Container, Group, Stack, Title, Text, Paper } from "@mantine/core";

export default async function MeetingsPage() {
  const meetings = await getMeetings();

  return (
    <Container size="sm" py="xl">
      <Stack gap="xl">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Group gap="sm">
              <Paper radius="md" withBorder px="xs" py={4}>
                <Calendar className="h-5 w-5" />
              </Paper>
              <div>
                <Title order={2}>Meetings</Title>
                <Text size="sm" c="dimmed">
                  Stay on top of upcoming sessions and follow-ups.
                </Text>
              </div>
            </Group>
          </Stack>
        </Group>

        <Stack gap="md">
          {meetings.length > 0 ? (
            meetings.map(meeting => <MeetingCard key={meeting.id} meeting={meeting} />)
          ) : (
            <Paper withBorder radius="lg" p="xl" ta="center">
              <Calendar className="mx-auto mb-3 h-12 w-12 text-gray-400" />
              <Text c="dimmed">No meetings scheduled</Text>
            </Paper>
          )}
        </Stack>
      </Stack>
    </Container>
  );
}
