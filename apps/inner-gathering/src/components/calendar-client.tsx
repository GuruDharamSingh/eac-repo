"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MeetingCalendar } from "./calendar/meeting-calendar";
import {
  Badge,
  Button,
  Container,
  Drawer,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Calendar as CalendarIcon, Plus, ExternalLink, MapPin, Video, Clock, User, FileText } from "lucide-react";
import type { Meeting } from "@elkdonis/types";
import { format } from "date-fns";

interface CalendarClientProps {
  initialMeetings: Meeting[];
}

export function CalendarClient({ initialMeetings }: CalendarClientProps) {
  const router = useRouter();
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false);
  const nextcloudUrl = process.env.NEXT_PUBLIC_NEXTCLOUD_URL || 'http://localhost:8080';

  const handleSelectMeeting = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    openDrawer();
  };

  const handleCreateMeeting = () => {
    router.push("/feed?create=meeting");
  };

  const meetingDate = selectedMeeting?.scheduledAt
    ? new Date(selectedMeeting.scheduledAt)
    : selectedMeeting?.startTime;

  return (
    <Container size="xl" py="xl">
      {/* Header */}
      <Group justify="space-between" mb="lg" wrap="wrap">
        <div>
          <Group gap="xs" mb={4}>
            <ThemeIcon size="lg" radius="md" variant="light" color="indigo">
              <CalendarIcon size={20} />
            </ThemeIcon>
            <Title order={2}>Community Calendar</Title>
          </Group>
          <Text c="dimmed">
            View and manage all community events and gatherings
          </Text>
        </div>
        <Group gap="xs">
          <Button
            component="a"
            href={`${nextcloudUrl}/apps/calendar`}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
            leftSection={<ExternalLink size={16} />}
          >
            Nextcloud
          </Button>
          <Button onClick={handleCreateMeeting} leftSection={<Plus size={16} />}>
            Create Meeting
          </Button>
        </Group>
      </Group>

      {/* Calendar Component */}
      <MeetingCalendar
        meetings={initialMeetings}
        onSelectMeeting={handleSelectMeeting}
      />

      {/* Meeting Details Drawer */}
      <Drawer
        opened={drawerOpened}
        onClose={closeDrawer}
        position="bottom"
        size="auto"
        title={<Title order={4}>{selectedMeeting?.title}</Title>}
      >
        {selectedMeeting && (
          <Stack gap="md" maw={600}>
            {/* Status Badge */}
            <Group gap="xs">
              {selectedMeeting.isOnline && (
                <Badge variant="light" color="cyan" leftSection={<Video size={12} />}>
                  Online
                </Badge>
              )}
              <Badge variant="outline">{selectedMeeting.status}</Badge>
            </Group>

            {/* Date & Time */}
            {meetingDate && (
              <Group gap="xs">
                <Clock size={16} color="var(--mantine-color-gray-6)" />
                <Text size="sm">
                  {format(meetingDate, "EEEE, MMMM d, yyyy 'at' h:mm a")}
                  {selectedMeeting.durationMinutes && (
                    <Text span c="dimmed" ml={4}>
                      ({selectedMeeting.durationMinutes} minutes)
                    </Text>
                  )}
                </Text>
              </Group>
            )}

            {/* Location */}
            {selectedMeeting.location && (
              <Group gap="xs">
                <MapPin size={16} color="var(--mantine-color-gray-6)" />
                <Text size="sm">{selectedMeeting.location}</Text>
              </Group>
            )}

            {/* Guide */}
            {selectedMeeting.guide && (
              <Group gap="xs">
                <User size={16} color="var(--mantine-color-gray-6)" />
                <Text size="sm">Guide: {selectedMeeting.guide.displayName}</Text>
              </Group>
            )}

            {/* Description */}
            {selectedMeeting.description && (
              <div>
                <Text fw={600} size="sm" mb={4}>Description</Text>
                <Text size="sm" c="dimmed">
                  {selectedMeeting.description}
                </Text>
              </div>
            )}

            {/* Actions */}
            <Stack gap="xs" mt="md">
              {selectedMeeting.nextcloudTalkToken && (
                <Button
                  component="a"
                  href={`/api/talk/join?token=${selectedMeeting.nextcloudTalkToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  fullWidth
                  leftSection={<Video size={16} />}
                >
                  Join Talk Room
                </Button>
              )}

              {selectedMeeting.documentUrl && (
                <Button
                  component="a"
                  href={selectedMeeting.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outline"
                  fullWidth
                  leftSection={<FileText size={16} />}
                >
                  View Document
                </Button>
              )}
            </Stack>
          </Stack>
        )}
      </Drawer>
    </Container>
  );
}
