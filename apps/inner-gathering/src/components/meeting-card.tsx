"use client";

import { useState, useEffect } from "react";
import {
  ActionIcon,
  Anchor,
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Menu,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Loader,
} from "@mantine/core";
import { stripHtml } from "@/lib/strip-html";
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  User,
  FileText,
  ExternalLink,
  Users,
  MoreVertical,
  UserCheck,
  UserPlus,
  UserX,
  ClipboardList,
  Radio,
  Repeat,
  LayoutGrid,
} from "lucide-react";
import type { Meeting } from "@elkdonis/types";
import { useRealtimeAttendees } from "@elkdonis/hooks";
import { MediaPlayer, ImageLightbox } from "@elkdonis/ui";
import { supabase } from "@/lib/supabase";
import NextImage from "next/image";
import Link from "next/link";

interface MeetingCardProps {
  meeting: Meeting;
  onViewAttendees?: (meeting: Meeting) => void;
}

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

const TIMEZONE_DISPLAY = [
  { zone: "America/New_York", label: "EST" },
  { zone: "America/Los_Angeles", label: "PST" },
  { zone: "Europe/Paris", label: "Paris" },
] as const;

const formatTimeInZone = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(date);

function isHappeningNow(meeting: Meeting): boolean {
  if (!meeting.scheduledAt) return false;
  const now = new Date();
  const start = new Date(meeting.scheduledAt);
  const durationMs = (meeting.durationMinutes || 60) * 60 * 1000;
  const end = new Date(start.getTime() + durationMs);
  return now >= start && now <= end;
}

// Check if RSVP should still be allowed (meeting today or not yet ended)
function canStillRsvp(meeting: Meeting): boolean {
  if (!meeting.scheduledAt) return true;
  const now = new Date();
  const meetingDate = new Date(meeting.scheduledAt);
  const durationMs = (meeting.durationMinutes || 60) * 60 * 1000;
  const endTime = new Date(meetingDate.getTime() + durationMs);
  // Allow RSVP until 1 hour after meeting ends
  const rsvpDeadline = new Date(endTime.getTime() + 60 * 60 * 1000);
  return now < rsvpDeadline;
}

export function MeetingCard({ meeting, onViewAttendees }: MeetingCardProps) {
  const [mounted, setMounted] = useState(false);
  const [isAttending, setIsAttending] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rsvpChecked, setRsvpChecked] = useState(false);
  const [happeningNow, setHappeningNow] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const guideName = meeting.guide?.displayName || meeting.creator?.displayName || "Unknown";
  const coverImageId = meeting.coverImage?.id;
  const attachments = (meeting.media || []).filter((media) => media.id !== coverImageId);

  // Check if meeting is in the past
  const isPastMeeting = meeting.scheduledAt && new Date(meeting.scheduledAt) < new Date();

  // Realtime attendee count
  const { attendeeCount, recentChanges, initializeCount } = useRealtimeAttendees({
    client: supabase,
    meetingId: meeting.id,
    enabled: meeting.isRSVPEnabled === true,
  });

  // Initialize the attendee count from server data
  useEffect(() => {
    if (meeting.attendeeCount !== undefined) {
      initializeCount(meeting.attendeeCount);
    }
  }, [meeting.attendeeCount, initializeCount]);

  // Live attendee count (prefer realtime, fall back to server)
  const displayAttendeeCount = attendeeCount ?? meeting.attendeeCount ?? 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check "happening now" status and update periodically
  useEffect(() => {
    if (!meeting.scheduledAt) return;
    setHappeningNow(isHappeningNow(meeting));
    const interval = setInterval(() => {
      setHappeningNow(isHappeningNow(meeting));
    }, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [meeting.scheduledAt, meeting.durationMinutes]);

  // Check RSVP status on mount
  useEffect(() => {
    if (meeting.isRSVPEnabled && !rsvpChecked) {
      checkRsvpStatus();
    }
  }, [meeting.id, meeting.isRSVPEnabled, rsvpChecked]);

  const checkRsvpStatus = async () => {
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/rsvp`);
      if (res.ok) {
        const data = await res.json();
        setIsAttending(data.attending);
        setAttendanceStatus(data.status);
      }
    } catch (error) {
      console.error("Error checking RSVP status:", error);
    } finally {
      setRsvpChecked(true);
    }
  };

  const handleRsvp = async (shouldAttend: boolean) => {
    if (shouldAttend === isAttending) return;

    setIsLoading(true);
    try {
      if (!shouldAttend) {
        // Cancel RSVP
        const res = await fetch(`/api/meetings/${meeting.id}/rsvp`, { method: "DELETE" });
        if (res.ok) {
          setIsAttending(false);
          setAttendanceStatus(null);
        }
      } else {
        // Register RSVP
        const res = await fetch(`/api/meetings/${meeting.id}/rsvp`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          setIsAttending(true);
          setAttendanceStatus(data.status);
        }
      }
    } catch (error) {
      console.error("Error updating RSVP:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Paper withBorder radius="sm" className="parchment-card" style={{ overflow: "hidden" }}>
      {/* Cover Image */}
      {meeting.coverImage?.url && (
        <Box
          pos="relative"
          h={192}
          bg="gray.1"
          style={{ cursor: "pointer" }}
          onClick={() => setLightboxUrl(meeting.coverImage!.url)}
        >
          <NextImage
            src={meeting.coverImage.url}
            alt={meeting.coverImage.altText || meeting.title}
            fill
            style={{ objectFit: "cover" }}
            unoptimized
          />
        </Box>
      )}

      <Stack gap="md" p="md">
        {/* Title & Menu */}
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs" style={{ flex: 1 }}>
            <Title order={4}>{meeting.title}</Title>
            <Group gap="xs">
              <Badge variant="filled" color="ember" style={{ letterSpacing: '0.06em' }}>Meeting</Badge>
              {meeting.isOnline && (
                <Badge variant="light" color="cyan" leftSection={<Video size={12} />}>
                  Online
                </Badge>
              )}
              {happeningNow && (
                <Badge
                  variant="filled"
                  color="red"
                  leftSection={<Radio size={12} />}
                  style={{ animation: "pulse 2s ease-in-out infinite" }}
                >
                  Happening Now
                </Badge>
              )}
              {!happeningNow && isPastMeeting && (
                <Badge variant="light" color="gray">Past</Badge>
              )}
              {isAttending && (
                <Badge variant="light" color="teal" leftSection={<UserCheck size={12} />}>
                  Attending
                </Badge>
              )}
              {meeting.recurrencePattern && meeting.recurrencePattern !== "NONE" && (
                <Badge variant="light" color="violet" leftSection={<Repeat size={12} />}>
                  {meeting.recurrencePattern === "DAILY" ? "Daily" :
                   meeting.recurrencePattern === "WEEKLY" ? "Weekly" :
                   meeting.recurrencePattern === "MONTHLY" ? "Monthly" : "Recurring"}
                </Badge>
              )}
            </Group>
          </Stack>

          {/* Meeting Menu */}
          <Menu shadow="md" width={200} position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" size="sm">
                <MoreVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {meeting.hasEventPage && (
                <Menu.Item
                  component={Link}
                  href={`/meetings/${meeting.id}`}
                  leftSection={<LayoutGrid size={14} />}
                >
                  Go to Event Page
                </Menu.Item>
              )}
              {meeting.isRSVPEnabled && onViewAttendees && (
                <Menu.Item
                  leftSection={<ClipboardList size={14} />}
                  onClick={() => onViewAttendees(meeting)}
                >
                  {isPastMeeting ? "Attendance Report" : "View Attendees"}
                </Menu.Item>
              )}
              {meeting.documentUrl && (
                <Menu.Item
                  component="a"
                  href={meeting.documentUrl}
                  target="_blank"
                  leftSection={<FileText size={14} />}
                >
                  Open Document
                </Menu.Item>
              )}
              {meeting.nextcloudTalkToken && (
                <Menu.Item
                  component="a"
                  href={`/api/talk/join?token=${meeting.nextcloudTalkToken}`}
                  target="_blank"
                  leftSection={<Video size={14} />}
                >
                  Join Talk Room
                </Menu.Item>
              )}
            </Menu.Dropdown>
          </Menu>
        </Group>

        {/* Description */}
        {meeting.description && (
          <Text size="sm" c="dimmed" lineClamp={2}>
            {stripHtml(meeting.description)}
          </Text>
        )}

        {/* Details */}
        <Stack gap={6}>
          {/* Date & Time */}
          {meeting.scheduledAt && mounted && (
            <>
              <Group gap="lg">
                <Group gap="xs">
                  <ThemeIcon size="sm" radius="sm" variant="light" color="ember">
                    <Calendar size={14} />
                  </ThemeIcon>
                  <Text size="sm" fw={500}>{formatDate(new Date(meeting.scheduledAt))}</Text>
                </Group>
                <Group gap="xs">
                  <ThemeIcon size="sm" radius="sm" variant="light" color="ember">
                    <Clock size={14} />
                  </ThemeIcon>
                  <Text size="sm">
                    {formatTime(new Date(meeting.scheduledAt))}
                    {meeting.durationMinutes && (
                      <Text span size="xs" c="dimmed" ml={4}>({meeting.durationMinutes}m)</Text>
                    )}
                  </Text>
                </Group>
              </Group>
              <Group gap={8} ml={2}>
                {TIMEZONE_DISPLAY.map(({ zone, label }) => (
                  <Text key={zone} size="xs" c="dimmed">
                    <Text span size="xs" fw={600}>{label}</Text>{" "}
                    {formatTimeInZone(new Date(meeting.scheduledAt), zone)}
                  </Text>
                ))}
              </Group>
            </>
          )}

          {/* Location */}
          {meeting.location && (
            <Group gap="xs">
              <ThemeIcon size="sm" radius="sm" variant="light" color="ember">
                <MapPin size={14} />
              </ThemeIcon>
              <Text size="sm">{meeting.location}</Text>
            </Group>
          )}

          {/* Guide */}
          <Group gap="xs">
            <Avatar src={meeting.guide?.avatarUrl} size="sm" radius="xl" color="ember">
              {guideName[0]}
            </Avatar>
            <Text size="sm">
              Guide: <Text span fw={500}>{guideName}</Text>
            </Text>
          </Group>

          {/* Attendee Count (live) */}
          {meeting.isRSVPEnabled && (
            <Group gap="xs">
              <ThemeIcon size="sm" radius="md" variant="light" color="teal">
                <Users size={14} />
              </ThemeIcon>
              <Text size="sm">
                <Text span fw={500}>{displayAttendeeCount}</Text>
                {meeting.attendeeLimit ? (
                  <Text span c="dimmed"> / {meeting.attendeeLimit} attending</Text>
                ) : (
                  <Text span c="dimmed"> attending</Text>
                )}
              </Text>
              {recentChanges.length > 0 && recentChanges[0].type === 'join' && (
                <Badge size="xs" variant="light" color="teal">
                  +1 just RSVP'd
                </Badge>
              )}
            </Group>
          )}
        </Stack>

        {/* Media Attachments */}
        {attachments.length > 0 && (
          <>
            <Divider />
            <Stack gap="xs">
              <Text size="xs" tt="uppercase" fw={500} c="dimmed">Media</Text>
              {attachments.map((media) => {
                const mediaType = media.type || media.mimeType?.split("/")[0];

                if (mediaType === "video" || mediaType === "audio" || mediaType === "image") {
                  return (
                    <MediaPlayer
                      key={media.id}
                      url={media.url}
                      type={mediaType as "video" | "audio" | "image"}
                      title={media.filename}
                      onImageClick={mediaType === "image" ? setLightboxUrl : undefined}
                    />
                  );
                }

                return (
                  <Anchor
                    key={media.id}
                    href={media.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="xs"
                  >
                    <Group gap="xs">
                      <FileText size={12} />
                      <Text size="xs" truncate style={{ flex: 1 }}>{media.filename || "Download"}</Text>
                      <ExternalLink size={12} />
                    </Group>
                  </Anchor>
                );
              })}
            </Stack>
          </>
        )}

        {/* Actions Footer */}
        {(meeting.isRSVPEnabled || meeting.nextcloudTalkToken || meeting.documentUrl || meeting.hasEventPage) && (
          <>
            <Divider />
            <Stack gap="xs">
              {/* RSVP Buttons - only for upcoming meetings with RSVP enabled */}
              {meeting.isRSVPEnabled && !isPastMeeting && (
                <Group grow gap="xs">
                  <Button
                    size="sm"
                    variant={isAttending ? "filled" : "light"}
                    color="teal"
                    leftSection={isAttending ? <UserCheck size={16} /> : <UserPlus size={16} />}
                    onClick={() => handleRsvp(true)}
                    disabled={isLoading}
                  >
                    I'm Going
                  </Button>
                  <Button
                    size="sm"
                    variant={!isAttending ? "filled" : "light"}
                    color="gray"
                    leftSection={<UserX size={16} />}
                    onClick={() => handleRsvp(false)}
                    disabled={isLoading}
                  >
                    Not Going
                  </Button>
                </Group>
              )}

              {/* Past meeting - show attendance summary button */}
              {meeting.isRSVPEnabled && isPastMeeting && onViewAttendees && (
                <Button
                  fullWidth
                  size="sm"
                  variant="light"
                  color="gray"
                  leftSection={<ClipboardList size={16} />}
                  onClick={() => onViewAttendees(meeting)}
                >
                  View Attendance Report
                </Button>
              )}

              {meeting.hasEventPage && (
                <Button
                  component={Link}
                  href={`/meetings/${meeting.id}`}
                  fullWidth
                  size="sm"
                  variant="light"
                  color="ember"
                  leftSection={<LayoutGrid size={16} />}
                >
                  View Event Page
                </Button>
              )}

              {meeting.nextcloudTalkToken && (
                <Button
                  component="a"
                  href={`/api/talk/join?token=${meeting.nextcloudTalkToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  fullWidth
                  size="sm"
                  variant="outline"
                  leftSection={<Video size={16} />}
                >
                  Join Talk Room
                </Button>
              )}

              {meeting.documentUrl && (
                <Button
                  component="a"
                  href={meeting.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outline"
                  fullWidth
                  size="sm"
                  leftSection={<FileText size={16} />}
                >
                  Living Document
                </Button>
              )}
            </Stack>
          </>
        )}
      </Stack>

      <ImageLightbox
        url={lightboxUrl}
        alt={meeting.title}
        opened={lightboxUrl !== null}
        onClose={() => setLightboxUrl(null)}
      />
    </Paper>
  );
}
