"use client";

import { useEffect, useState } from "react";
import { Stack, Title, Table, Text, Badge, Group, Loader } from "@mantine/core";
import { CheckCircle, XCircle } from "lucide-react";

interface CycleEvent {
  id: string;
  action: "confirmed" | "cancelled";
  userId: string;
  userName: string;
  createdAt: string;
}

interface DayGroup {
  day: string;
  confirms: CycleEvent[];
  cancels: CycleEvent[];
}

const dayKey = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(iso));

const timeOf = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));

// Per-day confirm/cancel log for a recurring meeting (last 14 days).
export function CycleHistory({ meetingId }: { meetingId: string }) {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<DayGroup[]>([]);

  useEffect(() => {
    fetch(`/api/meetings/${meetingId}/cycle-history`)
      .then((res) => (res.ok ? res.json() : { events: [] }))
      .then((data) => {
        const events: CycleEvent[] = data.events || [];
        const grouped: Record<string, DayGroup> = {};
        for (const e of events) {
          const key = dayKey(e.createdAt);
          if (!grouped[key]) grouped[key] = { day: key, confirms: [], cancels: [] };
          if (e.action === "confirmed") grouped[key].confirms.push(e);
          else grouped[key].cancels.push(e);
        }
        // Preserve newest-first order from the API
        const order: string[] = [];
        for (const e of events) {
          const key = dayKey(e.createdAt);
          if (!order.includes(key)) order.push(key);
        }
        setDays(order.map((k) => grouped[k]));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [meetingId]);

  if (loading) {
    return (
      <Group justify="center" py="md">
        <Loader size="sm" />
      </Group>
    );
  }

  if (days.length === 0) {
    return (
      <Stack gap="xs">
        <Title order={3} size="h4">Cycle history</Title>
        <Text size="sm" c="dimmed">No confirmations or cancellations in the last 14 days.</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="xs">
      <Title order={3} size="h4">Cycle history</Title>
      <Text size="xs" c="dimmed">Last 14 days — who confirmed or cancelled each occurrence.</Text>
      <Table withTableBorder withRowBorders verticalSpacing="xs" fz="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Day</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Who</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {days.map((d) => {
            const cancelledOnly = d.cancels.length > 0 && d.confirms.length === 0;
            return (
              <Table.Tr key={d.day}>
                <Table.Td><Text size="sm" fw={500}>{d.day}</Text></Table.Td>
                <Table.Td>
                  {cancelledOnly ? (
                    <Badge size="sm" variant="light" color="red" leftSection={<XCircle size={10} />}>
                      Cancelled
                    </Badge>
                  ) : (
                    <Badge size="sm" variant="light" color="teal" leftSection={<CheckCircle size={10} />}>
                      {d.confirms.length} confirmed
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {d.confirms.map((e) => `${e.userName} ${timeOf(e.createdAt)}`).join(", ")}
                    {d.cancels.length > 0 && d.confirms.length > 0 && " · "}
                    {d.cancels.map((e) => `${e.userName} cancelled ${timeOf(e.createdAt)}`).join(", ")}
                    {cancelledOnly && d.cancels.map((e) => `${e.userName} ${timeOf(e.createdAt)}`).join(", ")}
                  </Text>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
