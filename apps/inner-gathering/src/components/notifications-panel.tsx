"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ActionIcon,
  Badge,
  Box,
  Collapse,
  Group,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import {
  Bell,
  CalendarX,
  ChevronDown,
  UserPlus,
  Users,
  CheckCheck,
} from "lucide-react";

interface NotificationItem {
  id: string;
  kind: string;
  threadId: string | null;
  threadTitle: string | null;
  threadKind: string | null;
  actorName: string | null;
  data: Record<string, any>;
  readAt: string | null;
  createdAt: string;
}

function relative(date: string): string {
  const ms = Date.now() - new Date(date).getTime();
  const m = 60_000, h = 60 * m, d = 24 * h;
  if (ms < m) return "just now";
  if (ms < h) return `${Math.floor(ms / m)}m ago`;
  if (ms < d) return `${Math.floor(ms / h)}h ago`;
  if (ms < 30 * d) return `${Math.floor(ms / d)}d ago`;
  return new Date(date).toLocaleDateString();
}

// One-line headline per notification kind; details expand below.
function describe(n: NotificationItem): { icon: React.ReactNode; headline: string; detail: string } {
  const title = n.threadTitle || n.data?.title || "a meeting";
  const actor = n.actorName || "Someone";
  switch (n.kind) {
    case "meeting_cancelled":
      return {
        icon: <CalendarX size={15} color="var(--mantine-color-red-6)" />,
        headline: `Cancelled: ${title}`,
        detail:
          n.data?.role === "guide"
            ? `${actor} cancelled this cycle. You can still confirm it to keep it on.`
            : `${title} has been called off for now. We'll let you know when it's back on.`,
      };
    case "meeting_rsvp":
      return {
        icon: <UserPlus size={15} color="var(--mantine-color-teal-6)" />,
        headline: `${actor} is interested`,
        detail: `${actor} RSVP'd to ${title}.`,
      };
    case "meeting_min_attendees":
      return {
        icon: <Users size={15} color="var(--mantine-color-teal-6)" />,
        headline: `${title} hit its minimum`,
        detail: `${title} reached ${n.data?.minAttendees ?? "its minimum"} attendees (${n.data?.attendeeCount ?? "?"} going).`,
      };
    default:
      return {
        icon: <Bell size={15} color="var(--ig-gold, #8f763c)" />,
        headline: title,
        detail: "",
      };
  }
}

export function NotificationsPanel({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/notifications")
      .then((res) => (res.ok ? res.json() : { notifications: [] }))
      .then((data) => setItems(data.notifications || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unreadCount = items.filter((n) => !n.readAt).length;

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => {});
  }, []);

  const handleItemClick = (n: NotificationItem) => {
    // Expand to reveal detail; mark this one read.
    setExpandedId((cur) => (cur === n.id ? null : n.id));
    if (!n.readAt) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [n.id] }),
      }).catch(() => {});
    }
  };

  const openThread = (n: NotificationItem) => {
    if (!n.threadId) return;
    const path = n.threadKind === "workshop" ? `/workshops/${n.threadId}` : `/meetings/${n.threadId}`;
    onNavigate?.();
    router.push(path);
  };

  if (loading) return null;
  if (items.length === 0) {
    return (
      <Box px="xs">
        <Text size="xs" c="dimmed">No notifications yet.</Text>
      </Box>
    );
  }

  return (
    <Stack gap={4}>
      <Group justify="space-between" px="xs">
        <Group gap={6}>
          <Bell size={14} color="var(--ig-gold, #8f763c)" />
          <Text size="xs" fw={700} tt="uppercase" lts={0.6} c="dimmed">
            Notifications
          </Text>
          {unreadCount > 0 && (
            <Badge size="xs" variant="filled" color="red" circle>
              {unreadCount}
            </Badge>
          )}
        </Group>
        {unreadCount > 0 && (
          <ActionIcon size="sm" variant="subtle" color="gray" onClick={markAllRead} title="Mark all read">
            <CheckCheck size={15} />
          </ActionIcon>
        )}
      </Group>

      <Stack gap={2} mah={260} style={{ overflowY: "auto" }}>
        {items.map((n) => {
          const { icon, headline, detail } = describe(n);
          const expanded = expandedId === n.id;
          return (
            <Box
              key={n.id}
              style={{
                borderRadius: 4,
                background: n.readAt ? "transparent" : "rgba(183, 154, 85, 0.10)",
              }}
            >
              <UnstyledButton onClick={() => handleItemClick(n)} style={{ width: "100%", padding: "8px 10px" }}>
                <Group gap={8} wrap="nowrap" align="flex-start">
                  <Box mt={2} style={{ flexShrink: 0 }}>{icon}</Box>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Group gap={6} wrap="nowrap" justify="space-between">
                      <Text size="sm" fw={n.readAt ? 500 : 700} lineClamp={1} style={{ flex: 1 }}>
                        {headline}
                      </Text>
                      <ChevronDown
                        size={13}
                        style={{ flexShrink: 0, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 150ms" }}
                      />
                    </Group>
                    <Text size="xs" c="dimmed">{relative(n.createdAt)}</Text>
                  </Box>
                </Group>
              </UnstyledButton>
              <Collapse in={expanded}>
                <Box px={10} pb={10} pl={32}>
                  {detail && <Text size="xs" c="dimmed" mb={6}>{detail}</Text>}
                  {n.threadId && (
                    <UnstyledButton onClick={() => openThread(n)}>
                      <Text size="xs" fw={600} c="ember">View meeting →</Text>
                    </UnstyledButton>
                  )}
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Stack>
    </Stack>
  );
}
