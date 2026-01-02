"use client";

import * as React from "react";
import {
  Badge,
  Group,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { DatePicker } from "@mantine/dates";
import { Calendar as CalendarIcon, MapPin, Video, Clock } from "lucide-react";
import type { Meeting } from "@elkdonis/types";
import { format, isSameDay } from "date-fns";

interface MeetingCalendarProps {
  meetings: Meeting[];
  onSelectDate?: (date: Date) => void;
  onSelectMeeting?: (meeting: Meeting) => void;
}

export function MeetingCalendar({
  meetings,
  onSelectDate,
  onSelectMeeting
}: MeetingCalendarProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(new Date());

  // Get meetings for selected date
  const selectedDateMeetings = React.useMemo(() => {
    if (!selectedDate) return [];
    return meetings.filter((meeting) => {
      const meetingDate = meeting.scheduledAt ? new Date(meeting.scheduledAt) : meeting.startTime;
      return meetingDate && isSameDay(meetingDate, selectedDate);
    });
  }, [meetings, selectedDate]);

  // Get dates that have meetings (for highlighting)
  const meetingDates = React.useMemo(() => {
    return meetings.map((meeting) => {
      const date = meeting.scheduledAt ? new Date(meeting.scheduledAt) : meeting.startTime;
      return date;
    }).filter(Boolean) as Date[];
  }, [meetings]);

  const handleDateSelect = (date: Date | null) => {
    setSelectedDate(date);
    if (date && onSelectDate) {
      onSelectDate(date);
    }
  };

  // Custom day props to show meeting indicators
  const getDayProps = (date: Date) => {
    const hasMeeting = meetingDates.some(d => isSameDay(d, date));
    if (hasMeeting) {
      return {
        style: {
          backgroundColor: 'var(--mantine-color-indigo-1)',
          borderRadius: 'var(--mantine-radius-sm)',
        },
      };
    }
    return {};
  };

  return (
    <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
      {/* Calendar */}
      <Paper withBorder radius="lg" p="md">
        <DatePicker
          value={selectedDate}
          onChange={handleDateSelect}
          size="md"
          getDayProps={getDayProps}
        />
      </Paper>

      {/* Selected Date Events */}
      <Paper withBorder radius="lg" p="md">
        <Stack gap="md">
          <Group gap="xs">
            <ThemeIcon size="sm" radius="md" variant="light" color="indigo">
              <CalendarIcon size={14} />
            </ThemeIcon>
            <Title order={5}>
              {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "Select a date"}
            </Title>
          </Group>

          {selectedDateMeetings.length === 0 ? (
            <Text c="dimmed" size="sm" ta="center" py="xl">
              No meetings scheduled for this day
            </Text>
          ) : (
            <ScrollArea h={400}>
              <Stack gap="sm">
                {selectedDateMeetings.map((meeting) => (
                  <CalendarEventCard
                    key={meeting.id}
                    meeting={meeting}
                    onClick={() => onSelectMeeting?.(meeting)}
                  />
                ))}
              </Stack>
            </ScrollArea>
          )}
        </Stack>
      </Paper>
    </SimpleGrid>
  );
}

interface CalendarEventCardProps {
  meeting: Meeting;
  onClick?: () => void;
}

function CalendarEventCard({ meeting, onClick }: CalendarEventCardProps) {
  const meetingDate = meeting.scheduledAt ? new Date(meeting.scheduledAt) : meeting.startTime;
  const time = meetingDate ? format(meetingDate, "h:mm a") : "Time TBA";

  return (
    <UnstyledButton onClick={onClick} style={{ width: '100%' }}>
      <Paper withBorder radius="md" p="sm" style={{ cursor: 'pointer' }}>
        <Stack gap="xs">
          <Group justify="space-between" gap="xs">
            <Text fw={500} size="sm" lineClamp={1} style={{ flex: 1 }}>
              {meeting.title}
            </Text>
            {meeting.isOnline && (
              <Badge variant="light" color="cyan" size="sm" leftSection={<Video size={10} />}>
                Online
              </Badge>
            )}
          </Group>

          <Group gap="md">
            <Group gap={4}>
              <Clock size={12} color="var(--mantine-color-gray-6)" />
              <Text size="xs" c="dimmed">{time}</Text>
            </Group>
            {meeting.durationMinutes && (
              <Text size="xs" c="dimmed">{meeting.durationMinutes} min</Text>
            )}
          </Group>

          {meeting.location && (
            <Group gap={4}>
              <MapPin size={12} color="var(--mantine-color-gray-6)" />
              <Text size="xs" c="dimmed">{meeting.location}</Text>
            </Group>
          )}

          {meeting.guide && (
            <Text size="xs" c="dimmed">
              Guide: {meeting.guide.displayName}
            </Text>
          )}
        </Stack>
      </Paper>
    </UnstyledButton>
  );
}
