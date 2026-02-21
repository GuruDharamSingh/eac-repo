"use client";

import { useEffect, useState } from "react";
import {
  Avatar,
  Badge,
  Box,
  Button,
  Container,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
  TypographyStylesProvider,
} from "@mantine/core";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Video,
  Pencil,
  Repeat,
  PenTool,
  ExternalLink,
} from "lucide-react";
import type { Meeting, EventPage } from "@elkdonis/types";
import Link from "next/link";
import { CommentSection } from "./comment-section";

interface ReplyData {
  id: string;
  parentId: string | null;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  reactionCount: number;
  userName: string;
  userAvatar: string | null;
  userInitials: string;
  userTrustLevel: number;
  commentColor?: string | null;
  children?: ReplyData[];
}

interface EventPageViewProps {
  meeting: Meeting;
  eventPage: EventPage | null;
  replies?: ReplyData[];
  currentUser?: {
    id: string;
    displayName: string | null;
    initials: string | null;
  } | null;
}

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));

export function EventPageView({ meeting, eventPage, replies = [], currentUser }: EventPageViewProps) {
  const guideName =
    meeting.guide?.displayName || meeting.creator?.displayName || "Unknown";

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const colors = eventPage?.colors || {};
  const layout = eventPage?.layout || "default";
  const hasContent =
    eventPage?.content && Object.keys(eventPage.content).length > 0;
  const htmlContent =
    typeof eventPage?.content === "object" && eventPage?.content !== null
      ? (eventPage.content as { html?: string }).html || ""
      : "";
  const rawTableData = eventPage?.tableData;
  const tableData = {
    columns: Array.isArray(rawTableData?.columns) ? rawTableData.columns : [],
    rows: Array.isArray(rawTableData?.rows) ? rawTableData.rows : [],
  };
  const hasTable = tableData.columns.length > 0 && tableData.rows.length > 0;

  return (
    <Box
      style={{
        ...(colors.background ? { backgroundColor: colors.background } : {}),
        ...(colors.text ? { color: colors.text } : {}),
        minHeight: "100vh",
      }}
    >
      <Container size="md" py="xl">
        <Stack gap="xl">
          {/* Header */}
          <Paper
            withBorder
            radius="lg"
            p="xl"
            style={{
              ...(colors.accent
                ? { borderColor: colors.accent, borderWidth: 2 }
                : {}),
            }}
          >
            <Stack gap="md">
              <Group justify="space-between" align="flex-start">
                <Stack gap="xs" style={{ flex: 1 }}>
                  <Title order={1}>{meeting.title}</Title>
                  <Group gap="xs">
                    <Badge variant="light" color="indigo">
                      Meeting
                    </Badge>
                    {meeting.isOnline && (
                      <Badge
                        variant="light"
                        color="cyan"
                        leftSection={<Video size={12} />}
                      >
                        Online
                      </Badge>
                    )}
                    {meeting.recurrencePattern &&
                      meeting.recurrencePattern !== "NONE" && (
                        <Badge
                          variant="light"
                          color="violet"
                          leftSection={<Repeat size={12} />}
                        >
                          {meeting.recurrencePattern === "DAILY"
                            ? "Daily"
                            : meeting.recurrencePattern === "WEEKLY"
                              ? "Weekly"
                              : meeting.recurrencePattern === "MONTHLY"
                                ? "Monthly"
                                : "Recurring"}
                        </Badge>
                      )}
                  </Group>
                </Stack>

                <Button
                  component={Link}
                  href={`/meetings/${meeting.id}/edit`}
                  variant="light"
                  leftSection={<Pencil size={16} />}
                  size="sm"
                >
                  Edit
                </Button>
              </Group>

              {meeting.description && (
                <TypographyStylesProvider>
                  <div
                    style={{ color: 'var(--mantine-color-dimmed)' }}
                    dangerouslySetInnerHTML={{ __html: meeting.description }}
                  />
                </TypographyStylesProvider>
              )}

              {/* Meeting Details */}
              <Stack gap="sm">
                {meeting.scheduledAt && mounted && (
                  <Group gap="lg">
                    <Group gap="xs">
                      <ThemeIcon
                        size="sm"
                        radius="md"
                        variant="light"
                        color="indigo"
                      >
                        <Calendar size={14} />
                      </ThemeIcon>
                      <Text size="sm" fw={500}>
                        {formatDate(meeting.scheduledAt)}
                      </Text>
                    </Group>
                    <Group gap="xs">
                      <ThemeIcon
                        size="sm"
                        radius="md"
                        variant="light"
                        color="indigo"
                      >
                        <Clock size={14} />
                      </ThemeIcon>
                      <Text size="sm">
                        {formatTime(meeting.scheduledAt)}
                        {meeting.durationMinutes && (
                          <Text span size="xs" c="dimmed" ml={4}>
                            ({meeting.durationMinutes}m)
                          </Text>
                        )}
                      </Text>
                    </Group>
                  </Group>
                )}

                {meeting.location && (
                  <Group gap="xs">
                    <ThemeIcon
                      size="sm"
                      radius="md"
                      variant="light"
                      color="indigo"
                    >
                      <MapPin size={14} />
                    </ThemeIcon>
                    <Text size="sm">{meeting.location}</Text>
                  </Group>
                )}

                <Group gap="xs">
                  <Avatar src={meeting.guide?.avatarUrl} size="sm" radius="xl" color="indigo">
                    {guideName[0]}
                  </Avatar>
                  <Text size="sm">
                    Guide: <Text span fw={500}>{guideName}</Text>
                  </Text>
                </Group>
              </Stack>
            </Stack>
          </Paper>

          {/* Rich Content */}
          {hasContent && htmlContent && (
            <Paper withBorder radius="lg" p="xl">
              <TypographyStylesProvider>
                <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
              </TypographyStylesProvider>
            </Paper>
          )}

          {/* Data Table */}
          {hasTable && (
            <Paper withBorder radius="lg" p="xl">
              <Stack gap="md">
                <Title order={3}>Details</Title>
                <Table
                  striped
                  highlightOnHover
                  withTableBorder
                  withColumnBorders
                >
                  <Table.Thead>
                    <Table.Tr>
                      {tableData.columns.map((col, i) => (
                        <Table.Th key={i}>{col}</Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {tableData.rows.map((row, ri) => (
                      <Table.Tr key={ri}>
                        {row.map((cell, ci) => (
                          <Table.Td key={ci}>{cell}</Table.Td>
                        ))}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Stack>
            </Paper>
          )}
          {/* Drawing Preview */}
          {eventPage?.drawing && (
            <Paper withBorder radius="lg" p="xl">
              <Stack gap="md" align="center">
                <Group gap="xs">
                  <PenTool size={20} />
                  <Title order={3}>Collaborative Drawing</Title>
                </Group>
                <Text size="sm" c="dimmed" ta="center">
                  View and interact with the shared drawing canvas
                </Text>
                <Button
                  component={Link}
                  href={`/meetings/${meeting.id}/drawing`}
                  variant="light"
                  size="lg"
                  leftSection={<PenTool size={18} />}
                  rightSection={<ExternalLink size={16} />}
                >
                  Open Drawing Canvas
                </Button>
              </Stack>
            </Paper>
          )}

          {/* Comments */}
          <CommentSection
            initialReplies={replies}
            meetingId={meeting.id}
            currentUserId={currentUser?.id ?? null}
            currentUserName={currentUser?.displayName ?? null}
            currentUserInitials={currentUser?.initials ?? null}
          />
        </Stack>
      </Container>
    </Box>
  );
}
