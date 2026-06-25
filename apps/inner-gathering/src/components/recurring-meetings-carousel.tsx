"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { stripHtml } from "@/lib/strip-html";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  MapPin,
  Repeat,
  Video,
  Users,
  LayoutGrid,
} from "lucide-react";
import Link from "next/link";
import type { Meeting, MeetingRecurrence } from "@elkdonis/types";

interface RecurringMeetingsCarouselProps {
  meetings: Meeting[];
  userId?: string | null;
  isAdmin?: boolean;
}

const RECURRENCE_LABELS: Record<MeetingRecurrence, string> = {
  NONE: "",
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  CUSTOM: "Custom",
};

const RECURRENCE_COLORS: Record<MeetingRecurrence, string> = {
  NONE: "gray",
  DAILY: "oxblood",
  WEEKLY: "archive",
  MONTHLY: "teal",
  CUSTOM: "orange",
};

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(date));

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));

export function RecurringMeetingsCarousel({ meetings, userId, isAdmin = false }: RecurringMeetingsCarouselProps) {
  if (meetings.length === 0) return null;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [wasDragged, setWasDragged] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setWasDragged(false);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
    scrollRef.current.style.cursor = "grabbing";
    scrollRef.current.style.userSelect = "none";
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    if (Math.abs(walk) > 5) setWasDragged(true);
    scrollRef.current.scrollLeft = scrollLeft - walk;
  }, [isDragging, startX, scrollLeft]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    if (scrollRef.current) {
      scrollRef.current.style.cursor = "grab";
      scrollRef.current.style.removeProperty("user-select");
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!scrollRef.current) return;
    setStartX(e.touches[0].pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
    setWasDragged(false);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!scrollRef.current) return;
    const x = e.touches[0].pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    if (Math.abs(walk) > 5) setWasDragged(true);
    scrollRef.current.scrollLeft = scrollLeft - walk;
  }, [startX, scrollLeft]);

  const scrollBy = useCallback((direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = direction === "left" ? -280 : 280;
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  }, []);

  return (
    <Paper withBorder radius="sm" p="md" className="archive-card">
      <Stack gap="sm">
        <Group justify="space-between">
          <Group gap="xs">
            <ThemeIcon size="sm" variant="light" color="archive">
              <Repeat size={14} />
            </ThemeIcon>
            <Title order={5} className="archive-title">
              Recurring Meetings
            </Title>
            <Badge size="sm" variant="light" color="archive">
              {meetings.length}
            </Badge>
          </Group>

          {/* Arrow navigation buttons */}
          {meetings.length > 2 && (
            <Group gap={4}>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="archive"
                onClick={() => scrollBy("left")}
                aria-label="Scroll left"
              >
                <ChevronLeft size={16} />
              </ActionIcon>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="archive"
                onClick={() => scrollBy("right")}
                aria-label="Scroll right"
              >
                <ChevronRight size={16} />
              </ActionIcon>
            </Group>
          )}
        </Group>

        {/* Draggable scroll container */}
        <Box
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          style={{
            display: "flex",
            gap: "var(--mantine-spacing-md)",
            overflowX: "auto",
            cursor: "grab",
            paddingBottom: 4,
            scrollBehavior: isDragging ? "auto" : "smooth",
            scrollbarWidth: "thin",
            scrollbarColor: "var(--ig-border) transparent",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {meetings.map((meeting) => (
            <RecurringMeetingCard
              key={meeting.id}
              meeting={meeting}
              preventClick={wasDragged}
              mounted={mounted}
              userId={userId}
              isAdmin={isAdmin}
            />
          ))}
        </Box>
      </Stack>
    </Paper>
  );
}

function RecurringMeetingCard({
  meeting,
  preventClick,
  mounted,
  userId,
  isAdmin,
}: {
  meeting: Meeting;
  preventClick: boolean;
  mounted: boolean;
  userId?: string | null;
  isAdmin?: boolean;
}) {
  const pattern = meeting.recurrencePattern || "WEEKLY";
  const [confirmed, setConfirmed] = useState(meeting.isConfirmedThisWeek ?? false);
  const [toggling, setToggling] = useState(false);

  const canConfirm = isAdmin || (userId && meeting.createdBy === userId);

  const handleConfirmToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canConfirm || toggling) return;
    setToggling(true);
    const next = !confirmed;
    try {
      const res = await fetch(`/api/content/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: next }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setConfirmed(next);
      notifications.show({
        color: next ? "teal" : "gray",
        message: next ? "Meeting confirmed for this week" : "Confirmation removed",
      });
    } catch {
      notifications.show({ color: "red", message: "Could not update confirmation" });
    } finally {
      setToggling(false);
    }
  };

  return (
    <Paper
      withBorder
      radius="md"
      p="sm"
      shadow="xs"
      component={preventClick ? "div" : Link}
      href={meeting.hasEventPage ? `/meetings/${meeting.id}` : `/feed`}
      style={{
        minWidth: 240,
        maxWidth: 280,
        flexShrink: 0,
        cursor: "pointer",
        transition: "box-shadow 150ms ease, transform 150ms ease",
        textDecoration: "none",
        color: "inherit",
        borderColor: confirmed ? "var(--mantine-color-teal-4)" : undefined,
      }}
      onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
        e.currentTarget.style.boxShadow = "var(--mantine-shadow-md)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
        e.currentTarget.style.boxShadow = "var(--mantine-shadow-xs)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
      onClick={(e: React.MouseEvent) => {
        if (preventClick) e.preventDefault();
      }}
    >
      <Stack gap="xs">
        {/* Confirmed banner */}
        {confirmed && (
          <Group gap={5} px={4} py={2} style={{ background: "var(--mantine-color-teal-0)", borderRadius: 4 }}>
            <CheckCircle size={12} color="var(--mantine-color-teal-6)" />
            <Text size="xs" fw={600} c="teal.7">Confirmed this week</Text>
          </Group>
        )}

        {/* Header with recurrence badge */}
        <Group justify="space-between" gap="xs">
          <Badge
            size="xs"
            variant="light"
            color={RECURRENCE_COLORS[pattern]}
            leftSection={<Repeat size={10} />}
          >
            {RECURRENCE_LABELS[pattern]}
          </Badge>
          <Group gap={4}>
            {(meeting.videoLink) && (
              <Tooltip label="Join video">
                <ActionIcon
                  component="a"
                  href={(meeting.videoLink)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="xs"
                  variant="light"
                  color="teal"
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  <Video size={11} />
                </ActionIcon>
              </Tooltip>
            )}
            {meeting.isOnline && !(meeting.videoLink) && (
              <Badge size="xs" variant="light" color="moss" leftSection={<Video size={10} />}>
                Online
              </Badge>
            )}
          </Group>
        </Group>

        {/* Title */}
        <Text fw={600} size="sm" lineClamp={2}>
          {meeting.title}
        </Text>

        {/* Description */}
        {meeting.description && (
          <Text size="xs" c="dimmed" lineClamp={2}>
            {stripHtml(meeting.description)}
          </Text>
        )}

        {/* Custom rule text */}
        {pattern === "CUSTOM" && meeting.recurrenceCustomRule && (
          <Text size="xs" c="orange.7" fs="italic">
            {meeting.recurrenceCustomRule}
          </Text>
        )}

        {/* Date & Time */}
        {mounted && (
          <Group gap={4}>
            <Calendar size={12} color="var(--mantine-color-gray-6)" />
            <Text size="xs" c="dimmed">
              {formatDate(meeting.scheduledAt)}
            </Text>
            <Clock size={12} color="var(--mantine-color-gray-6)" />
            <Text size="xs" c="dimmed">
              {formatTime(meeting.scheduledAt)}
            </Text>
          </Group>
        )}

        {/* Location / Attendees */}
        <Group gap="md">
          {meeting.location && (
            <Group gap={4}>
              <MapPin size={12} color="var(--mantine-color-gray-6)" />
              <Text size="xs" c="dimmed" lineClamp={1}>
                {meeting.location}
              </Text>
            </Group>
          )}
          {(meeting.attendeeCount ?? 0) > 0 && (
            <Group gap={4}>
              <Users size={12} color="var(--mantine-color-gray-6)" />
              <Text size="xs" c="dimmed">
                {meeting.attendeeCount}
              </Text>
            </Group>
          )}
        </Group>

        {/* Event Page indicator */}
        {meeting.hasEventPage && (
          <Badge
            size="xs"
            variant="light"
            color="archive"
            leftSection={<LayoutGrid size={10} />}
            fullWidth
            style={{ cursor: "pointer" }}
          >
            Has Event Page
          </Badge>
        )}

        {/* Confirm toggle (creator or admin only) */}
        {canConfirm && (
          <Button
            size="compact-xs"
            variant={confirmed ? "filled" : "light"}
            color={confirmed ? "teal" : "gray"}
            leftSection={<CheckCircle size={11} />}
            loading={toggling}
            onClick={handleConfirmToggle}
            fullWidth
          >
            {confirmed ? "Confirmed ✓" : "Confirm this week"}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
