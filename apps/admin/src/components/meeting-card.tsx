import { Meeting } from "@elkdonis/types";
import {
  Anchor,
  Badge,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import {
  Bell,
  Building2,
  Calendar,
  CalendarClock,
  ClipboardList,
  Clock,
  Globe,
  Link as LinkIcon,
  MapPin,
  Paperclip,
  RefreshCw,
  Tag,
  UserPlus,
  Users,
  Video,
} from "lucide-react";

interface MeetingCardProps {
  meeting: Meeting;
}

const statusCopy = (start: Date, end?: Date) => {
  const now = new Date();
  if (now < start) return { label: "Upcoming", color: "blue" as const };
  if (end && now > end) return { label: "Completed", color: "gray" as const };
  return { label: "In progress", color: "green" as const };
};

const recurrenceLabel = (meeting: Meeting) => {
  switch (meeting.recurrencePattern) {
    case "DAILY":
      return "Repeats daily";
    case "WEEKLY":
      return "Repeats weekly";
    case "MONTHLY":
      return "Repeats monthly";
    case "CUSTOM":
      return meeting.recurrenceCustomRule || "Custom cadence";
    default:
      return null;
  }
};

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

export function MeetingCard({ meeting }: MeetingCardProps) {
  const status = statusCopy(meeting.startTime, meeting.endTime);
  const recurrence = recurrenceLabel(meeting);
  const reminder =
    typeof meeting.reminderMinutesBefore === "number"
      ? `${meeting.reminderMinutesBefore} minute${meeting.reminderMinutesBefore === 1 ? "" : "s"} prior`
      : null;

  const organizerName = meeting.creator?.name ?? "Unknown organizer";
  const organizationName = meeting.organization?.name ?? "";

  return (
    <Paper withBorder radius="lg" p="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Text fw={600} size="lg">
              {meeting.title}
            </Text>
            <Group gap="xs">
              <Badge color={status.color} variant="light">
                {status.label}
              </Badge>
              <Badge variant="dot" color="gray">
                {meeting.visibility.replace("_", " ")}
              </Badge>
              {meeting.autoRecord ? (
                <Badge color="grape" leftSection={<Video size={14} />}>
                  Auto record
                </Badge>
              ) : null}
              {meeting.followUpWorkflow ? (
                <Badge color="teal" leftSection={<ClipboardList size={14} />}>
                  Follow-up
                </Badge>
              ) : null}
            </Group>
          </Stack>
          {meeting.videoLink ? (
            <ThemeIcon radius="md" variant="light" color="indigo">
              <LinkIcon size={16} />
            </ThemeIcon>
          ) : null}
        </Group>

        {meeting.description ? (
          <Text size="sm" c="dimmed">
            {meeting.description}
          </Text>
        ) : null}

        <Stack gap={6}>
          <Group gap="xs">
            <ThemeIcon size="sm" radius="md" variant="light">
              <Calendar size={14} />
            </ThemeIcon>
            <Text size="sm">{formatDate(meeting.startTime)}</Text>
          </Group>
          <Group gap="xs">
            <ThemeIcon size="sm" radius="md" variant="light">
              <Clock size={14} />
            </ThemeIcon>
            <Text size="sm">
              {formatTime(meeting.startTime)}
              {meeting.endTime ? ` - ${formatTime(meeting.endTime)}` : ""}
            </Text>
          </Group>
          {meeting.timeZone ? (
            <Group gap="xs">
              <ThemeIcon size="sm" radius="md" variant="light">
                <Globe size={14} />
              </ThemeIcon>
              <Text size="sm">{meeting.timeZone}</Text>
            </Group>
          ) : null}
          <Group gap="xs">
            <ThemeIcon size="sm" radius="md" variant="light">
              <MapPin size={14} />
            </ThemeIcon>
            <Text size="sm">{meeting.location ?? "Not set"}</Text>
          </Group>
          <Group gap="xs">
            <ThemeIcon size="sm" radius="md" variant="light">
              <Users size={14} />
            </ThemeIcon>
            <Text size="sm">Organized by {organizerName}</Text>
          </Group>
          {organizationName ? (
            <Group gap="xs">
              <ThemeIcon size="sm" radius="md" variant="light">
                <Building2 size={14} />
              </ThemeIcon>
              <Text size="sm">{organizationName}</Text>
            </Group>
          ) : null}
          {meeting.coHostIds.length > 0 ? (
            <Group gap="xs">
              <ThemeIcon size="sm" radius="md" variant="light">
                <UserPlus size={14} />
              </ThemeIcon>
              <Text size="sm">{meeting.coHostIds.length} co-host(s)</Text>
            </Group>
          ) : null}
          {meeting.videoLink ? (
            <Group gap="xs">
              <ThemeIcon size="sm" radius="md" variant="light">
                <Video size={14} />
              </ThemeIcon>
              <Anchor size="sm" href={meeting.videoLink} target="_blank" rel="noreferrer">
                Join link
              </Anchor>
            </Group>
          ) : null}
          {meeting.isRSVPEnabled ? (
            <Group gap="xs">
              <ThemeIcon size="sm" radius="md" color="blue" variant="light">
                <Users size={14} />
              </ThemeIcon>
              <Text size="sm">RSVP required</Text>
            </Group>
          ) : null}
          {reminder ? (
            <Group gap="xs">
              <ThemeIcon size="sm" radius="md" variant="light">
                <Bell size={14} />
              </ThemeIcon>
              <Text size="sm">{reminder}</Text>
            </Group>
          ) : null}
          {meeting.rsvpDeadline ? (
            <Group gap="xs">
              <ThemeIcon size="sm" radius="md" variant="light">
                <CalendarClock size={14} />
              </ThemeIcon>
              <Text size="sm">
                RSVP by {formatDate(meeting.rsvpDeadline)} at {formatTime(meeting.rsvpDeadline)}
              </Text>
            </Group>
          ) : null}
          {recurrence ? (
            <Group gap="xs">
              <ThemeIcon size="sm" radius="md" variant="light">
                <RefreshCw size={14} />
              </ThemeIcon>
              <Text size="sm">{recurrence}</Text>
            </Group>
          ) : null}
        </Stack>

        {meeting.tags.length > 0 ? (
          <>
            <Divider my="xs" />
            <Group gap="xs">
              <ThemeIcon size="sm" radius="md" variant="light">
                <Tag size={14} />
              </ThemeIcon>
              <Group gap="xs">
                {meeting.tags.map(tag => (
                  <Badge key={tag} variant="light" color="gray">
                    {tag}
                  </Badge>
                ))}
              </Group>
            </Group>
          </>
        ) : null}

        {meeting.attachments.length > 0 ? (
          <Group gap="xs">
            <ThemeIcon size="sm" radius="md" variant="light">
              <Paperclip size={14} />
            </ThemeIcon>
            <Text size="sm">{meeting.attachments.length} attachment(s)</Text>
          </Group>
        ) : null}
      </Stack>
    </Paper>
  );
}
