"use client";

import { useState, useEffect } from "react";
import {
  Anchor,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Image as MantineImage,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { Calendar, Clock, MapPin, Video, User, FileText, ExternalLink } from "lucide-react";
import type { Meeting } from "@elkdonis/types";
import { MediaPlayer } from "@elkdonis/ui";
import NextImage from "next/image";

interface MeetingCardProps {
  meeting: Meeting;
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

export function MeetingCard({ meeting }: MeetingCardProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const guideName = meeting.guide?.displayName || meeting.creator?.displayName || "Unknown";
  const coverImageId = meeting.coverImage?.id;
  const attachments = (meeting.media || []).filter((media) => media.id !== coverImageId);
  const nextcloudUrl = process.env.NEXT_PUBLIC_NEXTCLOUD_URL || 'http://localhost:8080';

  return (
    <Paper withBorder radius="lg" style={{ overflow: "hidden" }}>
      {/* Cover Image */}
      {meeting.coverImage?.url && (
        <Box pos="relative" h={192} bg="gray.1">
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
        {/* Title & Badges */}
        <Stack gap="xs">
          <Title order={4}>{meeting.title}</Title>
          <Group gap="xs">
            <Badge variant="light" color="indigo">Meeting</Badge>
            {meeting.isOnline && (
              <Badge variant="light" color="cyan" leftSection={<Video size={12} />}>
                Online
              </Badge>
            )}
          </Group>
        </Stack>

        {/* Description */}
        {meeting.description && (
          <Text size="sm" c="dimmed" lineClamp={2}>
            {meeting.description}
          </Text>
        )}

        {/* Details */}
        <Stack gap={6}>
          {/* Date & Time */}
          {meeting.scheduledAt && mounted && (
            <Group gap="lg">
              <Group gap="xs">
                <ThemeIcon size="sm" radius="md" variant="light" color="indigo">
                  <Calendar size={14} />
                </ThemeIcon>
                <Text size="sm" fw={500}>{formatDate(new Date(meeting.scheduledAt))}</Text>
              </Group>
              <Group gap="xs">
                <ThemeIcon size="sm" radius="md" variant="light" color="indigo">
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
          )}

          {/* Location */}
          {meeting.location && (
            <Group gap="xs">
              <ThemeIcon size="sm" radius="md" variant="light" color="indigo">
                <MapPin size={14} />
              </ThemeIcon>
              <Text size="sm">{meeting.location}</Text>
            </Group>
          )}

          {/* Guide */}
          <Group gap="xs">
            <ThemeIcon size="sm" radius="md" variant="light" color="indigo">
              <User size={14} />
            </ThemeIcon>
            <Text size="sm">
              Guide: <Text span fw={500}>{guideName}</Text>
            </Text>
          </Group>
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
        {(meeting.nextcloudTalkToken || meeting.documentUrl) && (
          <>
            <Divider />
            <Stack gap="xs">
              {meeting.nextcloudTalkToken && (
                <Button
                  component="a"
                  href={`/api/talk/join?token=${meeting.nextcloudTalkToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  fullWidth
                  size="sm"
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
    </Paper>
  );
}
