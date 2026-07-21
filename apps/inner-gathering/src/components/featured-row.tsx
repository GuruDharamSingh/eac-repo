"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import NextImage from "next/image";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Menu,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import {
  Calendar,
  CheckCircle,
  Clock,
  MoreHorizontal,
  Pin,
  PinOff,
  Repeat,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  Video,
  XCircle,
  MessageCircle,
} from "lucide-react";
import type { Meeting, Post, MeetingRecurrence } from "@elkdonis/types";
import { stripHtml } from "@/lib/strip-html";
import { nextOccurrence } from "@/lib/recurrence";
import { useRsvp } from "./use-rsvp";
import { useCycleStatus } from "./use-cycle-status";
import { ManageGuidesModal } from "./manage-guides-modal";

// ============================================================================
// Featured row — pinned + auto-featured recurring meetings, shown only on the
// All tab. Desktop: grid of compact cards. Mobile: one swipe row. Confirmed
// recurring sort first. CSS lives in globals.css under .featured-row*.
// ============================================================================

const RECURRENCE_LABELS: Record<MeetingRecurrence, string> = {
  NONE: "",
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  CUSTOM: "Custom",
};

const formatDay = (date: Date) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(date);

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);

type PinnedItem =
  | { type: "meeting"; data: Meeting }
  | { type: "post"; data: Post };

interface FeaturedRowProps {
  pinnedItems: PinnedItem[];
  recurringMeetings: Meeting[];
  userId?: string | null;
  isAdmin?: boolean;
  pinningThreadId?: string | null;
  onTogglePin?: (threadId: string, nextPinned: boolean) => void;
}

export function FeaturedRow({
  pinnedItems,
  recurringMeetings,
  userId,
  isAdmin = false,
  pinningThreadId,
  onTogglePin,
}: FeaturedRowProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Recurring meetings are auto-featured; pinned items follow, skipping any
  // meeting already shown as recurring. Confirmed recurring sort first.
  const recurringSorted = [...recurringMeetings].sort((a, b) => {
    const confirmDiff = Number(b.isConfirmedThisWeek ?? false) - Number(a.isConfirmedThisWeek ?? false);
    if (confirmDiff !== 0) return confirmDiff;
    return (
      nextOccurrence(new Date(a.scheduledAt), a.recurrencePattern, a.durationMinutes).getTime() -
      nextOccurrence(new Date(b.scheduledAt), b.recurrencePattern, b.durationMinutes).getTime()
    );
  });
  const recurringIds = new Set(recurringSorted.map((m) => m.id));
  const pinnedFiltered = pinnedItems.filter((item) => !recurringIds.has(item.data.id));

  const hasCards = recurringSorted.length > 0 || pinnedFiltered.length > 0;
  if (!hasCards) return null;

  return (
    <section className="featured-row-section">
      <header className="feed-carousel__header">
        <div className="feed-carousel__heading">
          <p className="feed-carousel__kicker">On the board</p>
          <h3 className="feed-carousel__title">
            Featured
            <span className="feed-carousel__count">{recurringSorted.length + pinnedFiltered.length}</span>
          </h3>
        </div>
      </header>

      <div className="featured-row">
        {recurringSorted.map((meeting) => (
          <CompactMeetingCard
            key={`recurring-${meeting.id}`}
            meeting={meeting}
            mounted={mounted}
            userId={userId}
            isAdmin={isAdmin}
            pinned={Boolean((meeting as any).metadata?.feedPinned)}
            pinning={pinningThreadId === meeting.id}
            onTogglePin={onTogglePin}
          />
        ))}

        {pinnedFiltered.map((item) =>
          item.type === "meeting" ? (
            <CompactMeetingCard
              key={`pinned-${item.data.id}`}
              meeting={item.data}
              mounted={mounted}
              userId={userId}
              isAdmin={isAdmin}
              pinned
              pinning={pinningThreadId === item.data.id}
              onTogglePin={onTogglePin}
            />
          ) : (
            <CompactPostCard
              key={`pinned-${item.data.id}`}
              post={item.data}
              isAdmin={isAdmin}
              pinning={pinningThreadId === item.data.id}
              onTogglePin={onTogglePin}
            />
          )
        )}
      </div>
    </section>
  );
}

// ─── Compact meeting card (recurring or pinned) ───

function CompactMeetingCard({
  meeting,
  mounted,
  userId,
  isAdmin,
  pinned,
  pinning,
  onTogglePin,
}: {
  meeting: Meeting;
  mounted: boolean;
  userId?: string | null;
  isAdmin?: boolean;
  pinned?: boolean;
  pinning?: boolean;
  onTogglePin?: (threadId: string, nextPinned: boolean) => void;
}) {
  const isRecurring = Boolean(meeting.recurrencePattern && meeting.recurrencePattern !== "NONE");
  const pattern = (meeting.recurrencePattern || "WEEKLY") as MeetingRecurrence;

  const [guidesOpen, setGuidesOpen] = useState(false);
  const { status, confirmCount, cancelCount, busy, confirm, cancel } = useCycleStatus(meeting);
  const { isAttending, isLoading, rsvp } = useRsvp(meeting.id, meeting.isRSVPEnabled === true);

  const confirmed = status === "confirmed";
  const cancelled = status === "cancelled";
  const isGuide = Boolean(userId && (meeting.createdBy === userId || (meeting.coGuideIds ?? []).includes(userId)));
  const canGuide = isRecurring && (isAdmin || isGuide);
  const canManageGuides = isAdmin || (userId && meeting.createdBy === userId);

  const occurrence = nextOccurrence(new Date(meeting.scheduledAt), meeting.recurrencePattern, meeting.durationMinutes);
  const detailHref = meeting.kind === "workshop" ? `/workshops/${meeting.id}` : `/meetings/${meeting.id}`;

  return (
    <Paper
      withBorder
      radius="md"
      className="featured-card"
      style={{
        overflow: "hidden",
        borderColor: confirmed
          ? "var(--mantine-color-teal-4)"
          : cancelled
            ? "var(--mantine-color-red-3)"
            : undefined,
        opacity: cancelled ? 0.92 : 1,
      }}
    >
      {meeting.coverImage?.url && (
        <Box pos="relative" h={84}>
          <NextImage
            src={meeting.coverImage.url}
            alt={meeting.coverImage.altText || meeting.title}
            fill
            style={{ objectFit: "cover" }}
            unoptimized
          />
        </Box>
      )}

      <Stack gap={6} p="sm" style={{ flex: 1 }}>
        <Group gap={4} justify="space-between" wrap="nowrap">
          <Group gap={4} wrap="nowrap" style={{ minWidth: 0 }}>
            {isRecurring && (
              <Badge size="xs" variant="light" color="grape" leftSection={<Repeat size={9} />}>
                {RECURRENCE_LABELS[pattern]}
              </Badge>
            )}
            {confirmed && (
              <Badge size="xs" variant="filled" color="teal" leftSection={<CheckCircle size={9} />}>
                Confirmed
              </Badge>
            )}
            {cancelled && (
              <Badge size="xs" variant="filled" color="red" leftSection={<XCircle size={9} />}>
                Cancelled
              </Badge>
            )}
            {pinned && !isRecurring && (
              <Badge size="xs" variant="light" color="ember" leftSection={<Pin size={9} />}>
                Pinned
              </Badge>
            )}
          </Group>
          {(canManageGuides || (isAdmin && onTogglePin)) && (
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon size="xs" variant="subtle" color="gray" disabled={pinning}>
                  <MoreHorizontal size={13} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {isAdmin && onTogglePin && (
                  <Menu.Item
                    leftSection={pinned ? <PinOff size={13} /> : <Pin size={13} />}
                    onClick={() => onTogglePin(meeting.id, !pinned)}
                  >
                    {pinned ? "Unpin" : "Pin above feed"}
                  </Menu.Item>
                )}
                {canManageGuides && (
                  <Menu.Item leftSection={<UserCog size={13} />} onClick={() => setGuidesOpen(true)}>
                    Manage guides
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>

        <Text component={Link} href={detailHref} fw={700} size="sm" lh={1.25} lineClamp={2}
          style={{ color: "var(--mantine-color-text)", textDecoration: "none" }}
        >
          {meeting.title}
        </Text>

        {/* Date & time — the NEXT occurrence; recurring shows cadence + start */}
        {mounted && (
          <Stack gap={1}>
            <Group gap={8} wrap="nowrap">
              <Group gap={4} wrap="nowrap">
                <Calendar size={13} color="var(--ig-gold, #8f763c)" />
                <Text size="sm" fw={600}>{isRecurring ? "Next: " : ""}{formatDay(occurrence)}</Text>
              </Group>
              <Group gap={4} wrap="nowrap">
                <Clock size={13} color="var(--ig-gold, #8f763c)" />
                <Text size="sm" fw={600}>{formatTime(occurrence)}</Text>
              </Group>
            </Group>
            {isRecurring && (
              <Text size="xs" c="dimmed">{cadenceSince(pattern, new Date(meeting.scheduledAt))}</Text>
            )}
          </Stack>
        )}

        {/* Live cycle counts */}
        <Group gap={10}>
          {confirmCount > 0 && (
            <Group gap={3}>
              <CheckCircle size={11} color="var(--mantine-color-teal-6)" />
              <Text size="xs" c="dimmed">{confirmCount} confirmed</Text>
            </Group>
          )}
          {meeting.isRSVPEnabled && (meeting.attendeeCount ?? 0) > 0 && (
            <Group gap={3}>
              <Users size={11} color="var(--mantine-color-gray-6)" />
              <Text size="xs" c="dimmed">{meeting.attendeeCount} going</Text>
            </Group>
          )}
        </Group>

        {/* Primary actions: RSVP + Video + Talk Room */}
        <Group gap={6} grow mt="auto">
          {meeting.isRSVPEnabled && (
            <Button
              size="compact-sm"
              variant={isAttending ? "filled" : "light"}
              color="teal"
              leftSection={isAttending ? <UserCheck size={13} /> : <UserPlus size={13} />}
              loading={isLoading}
              onClick={() => rsvp(!isAttending)}
            >
              {isAttending ? "Going" : "RSVP"}
            </Button>
          )}
          {meeting.videoLink && (
            <Button
              component="a"
              href={meeting.videoLink}
              target="_blank"
              rel="noopener noreferrer"
              size="compact-sm"
              variant={meeting.isRSVPEnabled ? "light" : "filled"}
              color="teal"
              leftSection={<Video size={13} />}
            >
              Video
            </Button>
          )}
          {meeting.nextcloudTalkToken && (
            <Button
              component="a"
              href={`/api/talk/join?token=${meeting.nextcloudTalkToken}`}
              target="_blank"
              rel="noopener noreferrer"
              size="compact-sm"
              variant="filled"
              color="teal"
              leftSection={<MessageCircle size={13} />}
            >
              Talk Room
            </Button>
          )}
        </Group>

        {/* Guide actions: Confirm + Cancel (recurring, guide/admin only) */}
        {canGuide && (
          <Group gap={6} grow>
            <Button
              size="compact-xs"
              variant={confirmed ? "filled" : "outline"}
              color="teal"
              leftSection={<CheckCircle size={11} />}
              loading={busy}
              onClick={confirm}
            >
              {confirmed ? "Confirmed" : "Confirm"}
            </Button>
            <Button
              size="compact-xs"
              variant={cancelled ? "filled" : "outline"}
              color="red"
              leftSection={<XCircle size={11} />}
              loading={busy}
              onClick={cancel}
            >
              {cancelled ? "Cancelled" : "Cancel"}
            </Button>
          </Group>
        )}

        <Group gap={6} wrap="nowrap">
          <Button component={Link} href={detailHref} size="compact-xs" variant="subtle" color="ember">
            Details →
          </Button>
        </Group>
      </Stack>

      {canManageGuides && (
        <ManageGuidesModal meetingId={meeting.id} opened={guidesOpen} onClose={() => setGuidesOpen(false)} />
      )}
    </Paper>
  );
}

// "Every day since Jun 30" — clarifies the chosen date is the START, not the
// single meeting date, so a daily meeting doesn't look stuck on its first day.
function cadenceSince(pattern: MeetingRecurrence, start: Date): string {
  const cadence =
    pattern === "DAILY" ? "Every day" :
    pattern === "WEEKLY" ? "Weekly" :
    pattern === "MONTHLY" ? "Monthly" : "Recurring";
  const since = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(start);
  const future = start.getTime() > Date.now();
  return `${cadence} ${future ? "from" : "since"} ${since}`;
}

// ─── Compact pinned post card ───

function CompactPostCard({
  post,
  isAdmin,
  pinning,
  onTogglePin,
}: {
  post: Post;
  isAdmin?: boolean;
  pinning?: boolean;
  onTogglePin?: (threadId: string, nextPinned: boolean) => void;
}) {
  return (
    <Paper withBorder radius="md" className="featured-card" style={{ overflow: "hidden" }}>
      {post.coverImage?.url && (
        <Box pos="relative" h={84}>
          <NextImage
            src={post.coverImage.url}
            alt={post.coverImage.altText || post.title}
            fill
            style={{ objectFit: "cover" }}
            unoptimized
          />
        </Box>
      )}
      <Stack gap={6} p="sm" style={{ flex: 1 }}>
        <Group gap={4} justify="space-between" wrap="nowrap">
          <Badge size="xs" variant="light" color="ember" leftSection={<Pin size={9} />}>
            Pinned
          </Badge>
          {isAdmin && onTogglePin && (
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon size="xs" variant="subtle" color="gray" disabled={pinning}>
                  <MoreHorizontal size={13} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<PinOff size={13} />} onClick={() => onTogglePin(post.id, false)}>
                  Unpin
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>

        <Text component={Link} href={`/posts/${post.id}`} fw={700} size="sm" lh={1.25} lineClamp={2}
          style={{ color: "var(--mantine-color-text)", textDecoration: "none" }}
        >
          {post.title}
        </Text>

        <Text size="xs" c="dimmed" lineClamp={2}>
          {post.excerpt || stripHtml(post.body || "")}
        </Text>

        <Group gap={6} grow mt="auto">
          <Button component={Link} href={`/posts/${post.id}`} size="compact-xs" variant="outline" color="ember">
            Read →
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
