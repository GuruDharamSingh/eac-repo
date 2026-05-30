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
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
  Switch,
} from "@mantine/core";
import { stripHtml } from "@/lib/strip-html";
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  FileText,
  ExternalLink,
  Users,
  UserCheck,
  UserPlus,
  UserX,
  ClipboardList,
  Radio,
  Repeat,
  LayoutGrid,
  Pin,
  PinOff,
  Trash2,
  Mail,
  Pencil,
  GraduationCap,
} from "lucide-react";
import type { Meeting } from "@elkdonis/types";
import { useRealtimeAttendees } from "@elkdonis/hooks";
import { MediaPlayer, ImageLightbox } from "@elkdonis/ui";
import { supabase } from "@/lib/supabase";
import NextImage from "next/image";
import Link from "next/link";
import { JoinWorkshopModal } from "@/components/join-workshop-modal";

interface MeetingCardProps {
  meeting: Meeting;
  onViewAttendees?: (meeting: Meeting) => void;
  canDelete?: boolean;
  deleting?: boolean;
  onDelete?: () => void;
  canPin?: boolean;
  pinned?: boolean;
  pinning?: boolean;
  onTogglePin?: () => void;
  showPrivateBadge?: boolean;
  canEdit?: boolean;
  onEdit?: (meeting: Meeting) => void;
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

function canStillRsvp(meeting: Meeting): boolean {
  if (!meeting.scheduledAt) return true;
  const now = new Date();
  const meetingDate = new Date(meeting.scheduledAt);
  const durationMs = (meeting.durationMinutes || 60) * 60 * 1000;
  const endTime = new Date(meetingDate.getTime() + durationMs);
  const rsvpDeadline = new Date(endTime.getTime() + 60 * 60 * 1000);
  return now < rsvpDeadline;
}

export function MeetingCard({
  meeting,
  onViewAttendees,
  canDelete = false,
  deleting = false,
  onDelete,
  canPin = false,
  pinned = false,
  pinning = false,
  onTogglePin,
  showPrivateBadge = false,
  canEdit = false,
  onEdit,
}: MeetingCardProps) {
  const [mounted, setMounted] = useState(false);
  const [isAttending, setIsAttending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rsvpChecked, setRsvpChecked] = useState(false);
  const [receiveEmailNotice, setReceiveEmailNotice] = useState(true);
  const [happeningNow, setHappeningNow] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);

  const guideName = meeting.guide?.displayName || meeting.creator?.displayName || "Unknown";
  const guideInitial = guideName[0]?.toUpperCase() ?? "?";
  const guideAvatar = meeting.guide?.avatarUrl || meeting.creator?.avatarUrl;

  const isWorkshop = meeting.kind === "workshop";
  const detailHref = isWorkshop ? `/workshops/${meeting.id}` : `/meetings/${meeting.id}`;

  const coverImageId = meeting.coverImage?.id;
  const attachments = (meeting.media || []).filter((m) => m.id !== coverImageId);
  const isPastMeeting = meeting.scheduledAt && new Date(meeting.scheduledAt) < new Date();

  const { attendeeCount, recentChanges, initializeCount } = useRealtimeAttendees({
    client: supabase,
    meetingId: meeting.id,
    enabled: meeting.isRSVPEnabled === true,
  });

  useEffect(() => {
    if (meeting.attendeeCount !== undefined) initializeCount(meeting.attendeeCount);
  }, [meeting.attendeeCount, initializeCount]);

  const displayAttendeeCount = attendeeCount ?? meeting.attendeeCount ?? 0;

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!meeting.scheduledAt) return;
    setHappeningNow(isHappeningNow(meeting));
    const interval = setInterval(() => setHappeningNow(isHappeningNow(meeting)), 30000);
    return () => clearInterval(interval);
  }, [meeting.scheduledAt, meeting.durationMinutes]);

  useEffect(() => {
    if (meeting.isRSVPEnabled && !rsvpChecked) checkRsvpStatus();
  }, [meeting.id, meeting.isRSVPEnabled, rsvpChecked]);

  const checkRsvpStatus = async () => {
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/rsvp`);
      if (res.ok) {
        const data = await res.json();
        setIsAttending(data.attending);
      }
    } catch {}
    finally { setRsvpChecked(true); }
  };

  const handleRsvp = async (shouldAttend: boolean) => {
    if (shouldAttend === isAttending) return;
    setIsLoading(true);
    try {
      if (!shouldAttend) {
        const res = await fetch(`/api/meetings/${meeting.id}/rsvp`, { method: "DELETE" });
        if (res.ok) setIsAttending(false);
      } else {
        const res = await fetch(`/api/meetings/${meeting.id}/rsvp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receiveEmailNotice }),
        });
        if (res.ok) setIsAttending(true);
      }
    } catch {}
    finally { setIsLoading(false); }
  };

  return (
    <Paper withBorder radius="md" className="parchment-card" style={{ overflow: "hidden" }}>
      {/* Cover image */}
      {meeting.coverImage?.url && (
        <Box pos="relative" h={180} style={{ cursor: "pointer" }} onClick={() => setLightboxUrl(meeting.coverImage!.url)}>
          <NextImage
            src={meeting.coverImage.url}
            alt={meeting.coverImage.altText || meeting.title}
            fill
            style={{ objectFit: "cover" }}
            unoptimized
          />
        </Box>
      )}

      <Stack gap={0}>
        {/* Header row: avatar + title + compact meta + admin actions */}
        <Group p="md" pb="xs" gap="sm" align="flex-start" wrap="nowrap">
          {/* Guide avatar */}
          <Avatar
            src={guideAvatar}
            size={42}
            radius="xl"
            color="ember"
            style={{ flexShrink: 0, marginTop: 2 }}
          >
            {guideInitial}
          </Avatar>

          {/* Title + tight inline meta (guide · date · time · location) */}
          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            <Text
              component={Link}
              href={detailHref}
              fw={700}
              size="md"
              lh={1.25}
              style={{
                color: 'var(--mantine-color-text)',
                textDecoration: 'none',
              }}
            >
              {meeting.title}
            </Text>
            {mounted && (
              <Group gap={6} wrap="wrap" style={{ rowGap: 2, columnGap: 8 }}>
                <Text size="xs" c="dimmed" fw={500} truncate>
                  {guideName}
                </Text>
                {meeting.scheduledAt && (
                  <>
                    <Text span size="xs" c="dimmed">·</Text>
                    <Group gap={3} wrap="nowrap">
                      <Calendar size={11} color="var(--mantine-color-gray-6)" />
                      <Text size="xs" c="dimmed">{formatDate(new Date(meeting.scheduledAt))}</Text>
                    </Group>
                    <Group gap={3} wrap="nowrap">
                      <Clock size={11} color="var(--mantine-color-gray-6)" />
                      <Text size="xs" c="dimmed">
                        {formatTime(new Date(meeting.scheduledAt))}
                        {meeting.durationMinutes && (
                          <Text span size="xs" c="dimmed" ml={3}>({meeting.durationMinutes}m)</Text>
                        )}
                      </Text>
                    </Group>
                  </>
                )}
                {meeting.location && (
                  <Group gap={3} wrap="nowrap" style={{ minWidth: 0, flexShrink: 1 }}>
                    <MapPin size={11} color="var(--mantine-color-gray-6)" />
                    <Text size="xs" c="dimmed" truncate style={{ maxWidth: 180 }}>
                      {meeting.location}
                    </Text>
                  </Group>
                )}
              </Group>
            )}
          </Stack>

          {/* Admin action icons */}
          <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
            {canPin && (
              <Tooltip label={pinned ? "Unpin" : "Pin above feed"}>
                <ActionIcon
                  variant={pinned ? "filled" : "subtle"}
                  color="ember"
                  size="sm"
                  disabled={pinning}
                  onClick={onTogglePin}
                >
                  {pinned ? <PinOff size={15} /> : <Pin size={15} />}
                </ActionIcon>
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip label="Delete">
                <ActionIcon variant="subtle" color="red" size="sm" disabled={deleting} onClick={onDelete}>
                  <Trash2 size={15} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Group>

        {/* Badges */}
        <Group px="md" pb="xs" gap="xs">
          <Badge
            variant="filled"
            color={isWorkshop ? "violet" : "ember"}
            size="sm"
            leftSection={isWorkshop ? <GraduationCap size={11} /> : undefined}
            style={{ letterSpacing: '0.05em' }}
          >
            {isWorkshop ? "Workshop" : "Meeting"}
          </Badge>
          {meeting.isOnline && (
            <Badge variant="light" color="cyan" size="sm" leftSection={<Video size={11} />}>Online</Badge>
          )}
          {happeningNow && (
            <Badge variant="filled" color="red" size="sm" leftSection={<Radio size={11} />} style={{ animation: "pulse 2s ease-in-out infinite" }}>
              Live Now
            </Badge>
          )}
          {!happeningNow && isPastMeeting && (
            <Badge variant="light" color="gray" size="sm">Past</Badge>
          )}
          {isAttending && (
            <Badge variant="light" color="teal" size="sm" leftSection={<UserCheck size={11} />}>Attending</Badge>
          )}
          {showPrivateBadge && meeting.visibility === "ORGANIZATION" && (
            <Badge variant="outline" color="gray" size="sm">Private</Badge>
          )}
          {meeting.recurrencePattern && meeting.recurrencePattern !== "NONE" && (
            <Badge variant="light" color="grape" size="sm" leftSection={<Repeat size={11} />}>
              {meeting.recurrencePattern === "DAILY" ? "Daily" :
               meeting.recurrencePattern === "WEEKLY" ? "Weekly" :
               meeting.recurrencePattern === "MONTHLY" ? "Monthly" : "Recurring"}
            </Badge>
          )}
        </Group>

        {/* Description */}
        {meeting.description && (
          <Text size="sm" c="dimmed" px="md" pb="xs" lineClamp={2}>
            {stripHtml(meeting.description)}
          </Text>
        )}

        {/* Attendee count */}
        {meeting.isRSVPEnabled && (
          <Group gap="xs" px="md" pb="xs">
            <ThemeIcon size="xs" radius="sm" variant="light" color="teal">
              <Users size={12} />
            </ThemeIcon>
            <Text size="sm">
              <Text span fw={500}>{displayAttendeeCount}</Text>
              {meeting.attendeeLimit
                ? <Text span c="dimmed"> / {meeting.attendeeLimit} attending</Text>
                : <Text span c="dimmed"> attending</Text>}
            </Text>
            {recentChanges.length > 0 && recentChanges[0].type === "join" && (
              <Badge size="xs" variant="light" color="teal">+1 just RSVP'd</Badge>
            )}
          </Group>
        )}

        {/* Media attachments */}
        {attachments.length > 0 && (
          <Stack gap="xs" px="md" pb="xs">
            <Divider />
            <Text size="xs" tt="uppercase" fw={500} c="dimmed">Attachments</Text>
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
                <Anchor key={media.id} href={media.url} target="_blank" rel="noopener noreferrer" size="xs">
                  <Group gap="xs">
                    <FileText size={12} />
                    <Text size="xs" truncate style={{ flex: 1 }}>{media.filename || "Download"}</Text>
                    <ExternalLink size={12} />
                  </Group>
                </Anchor>
              );
            })}
          </Stack>
        )}

        {/* Footer: RSVP + detail link + edit */}
        <Box px="md" pt="xs" pb="md">
          <Divider mb="sm" />
          <Stack gap="xs">
            {/* RSVP for upcoming meetings */}
            {meeting.isRSVPEnabled && !isPastMeeting && (
              <Stack gap={6}>
                {!isAttending && (
                  <Switch
                    size="xs"
                    color="teal"
                    checked={receiveEmailNotice}
                    onChange={(e) => setReceiveEmailNotice(e.currentTarget.checked)}
                    label="Email me a confirmation"
                    thumbIcon={receiveEmailNotice ? <Mail size={10} /> : undefined}
                    disabled={isLoading}
                  />
                )}
                <Group gap="xs" grow>
                  <Button
                    size="xs"
                    variant={isAttending ? "filled" : "light"}
                    color="teal"
                    leftSection={isAttending ? <UserCheck size={14} /> : <UserPlus size={14} />}
                    onClick={() => handleRsvp(true)}
                    disabled={isLoading}
                  >
                    I'm Going
                  </Button>
                  <Button
                    size="xs"
                    variant={!isAttending ? "light" : "subtle"}
                    color="gray"
                    leftSection={<UserX size={14} />}
                    onClick={() => handleRsvp(false)}
                    disabled={isLoading}
                  >
                    Can't Make It
                  </Button>
                </Group>
              </Stack>
            )}

            {/* Past meeting attendance */}
            {meeting.isRSVPEnabled && isPastMeeting && onViewAttendees && (
              <Button
                size="xs"
                variant="light"
                color="gray"
                leftSection={<ClipboardList size={14} />}
                onClick={() => onViewAttendees(meeting)}
              >
                View Attendance Report
              </Button>
            )}

            {/* Secondary actions row */}
            <Group gap="xs" justify="space-between">
              <Group gap="xs">
                {isWorkshop && !isPastMeeting && (
                  <Button
                    size="xs"
                    variant="filled"
                    color="ember"
                    leftSection={<GraduationCap size={13} />}
                    onClick={() => setJoinOpen(true)}
                  >
                    Join Workshop
                  </Button>
                )}
                {meeting.hasEventPage && (
                  <Button
                    component={Link}
                    href={`/meetings/${meeting.id}`}
                    size="xs"
                    variant="light"
                    color="ember"
                    leftSection={<LayoutGrid size={13} />}
                  >
                    Event Page
                  </Button>
                )}
                {meeting.nextcloudTalkToken && (
                  <Button
                    component="a"
                    href={`/api/talk/join?token=${meeting.nextcloudTalkToken}`}
                    target="_blank"
                    size="xs"
                    variant="outline"
                    leftSection={<Video size={13} />}
                  >
                    Join Room
                  </Button>
                )}
                {meeting.documentUrl && (
                  <Button
                    component="a"
                    href={meeting.documentUrl}
                    target="_blank"
                    size="xs"
                    variant="subtle"
                    leftSection={<FileText size={13} />}
                  >
                    Document
                  </Button>
                )}

                {/* View detail page */}
                <Button
                  component={Link}
                  href={detailHref}
                  size="xs"
                  variant="subtle"
                  color="gray"
                >
                  View details →
                </Button>
              </Group>

              {/* Admin edit */}
              {canEdit && (
                <Button
                  size="xs"
                  variant="light"
                  color="blue"
                  leftSection={<Pencil size={13} />}
                  onClick={() => onEdit?.(meeting)}
                >
                  Edit
                </Button>
              )}
            </Group>
          </Stack>
        </Box>
      </Stack>

      <ImageLightbox
        url={lightboxUrl}
        alt={meeting.title}
        opened={lightboxUrl !== null}
        onClose={() => setLightboxUrl(null)}
      />

      {isWorkshop && (
        <JoinWorkshopModal
          workshop={{
            id: meeting.id,
            title: meeting.title,
            price: (meeting as Meeting & { price?: number | null }).price ?? null,
            scheduledAt: meeting.scheduledAt,
            durationMinutes: meeting.durationMinutes,
            location: meeting.location,
            isOnline: meeting.isOnline,
          }}
          opened={joinOpen}
          onClose={() => setJoinOpen(false)}
        />
      )}
    </Paper>
  );
}
