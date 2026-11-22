"use client";

import { useState } from "react";
import {
  Box,
  SegmentedControl,
  Group,
  ActionIcon,
  Popover,
  Stack,
  Text,
  Button,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ChevronUp, ChevronDown, Settings2 } from "lucide-react";
import {
  type FeedTabKey,
  TAB_LABELS,
  FEED_TAB_ORDER_KEY,
  normalizeTabOrder,
} from "@/lib/feed-tabs";

interface FeedTabsBarProps {
  order: FeedTabKey[];
  value: FeedTabKey;
  onChange: (tab: FeedTabKey) => void;
  isAdmin?: boolean;
  counts?: Partial<Record<FeedTabKey, number>>;
  onOrderSaved?: (order: FeedTabKey[]) => void;
}

export function FeedTabsBar({
  order,
  value,
  onChange,
  isAdmin = false,
  counts,
  onOrderSaved,
}: FeedTabsBarProps) {
  const [reorderOpen, setReorderOpen] = useState(false);
  const [draft, setDraft] = useState<FeedTabKey[]>(order);
  const [saving, setSaving] = useState(false);

  const data = order.map((key) => ({
    value: key,
    label:
      counts?.[key] != null
        ? `${TAB_LABELS[key]} (${counts[key]})`
        : TAB_LABELS[key],
  }));

  const move = (index: number, dir: -1 | 1) => {
    const next = [...draft];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setDraft(next);
  };

  const saveOrder = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/site-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: FEED_TAB_ORDER_KEY, value: draft }),
      });
      if (!res.ok) throw new Error();
      const saved = normalizeTabOrder(draft);
      onOrderSaved?.(saved);
      notifications.show({ color: "teal", message: "Tab order saved" });
      setReorderOpen(false);
    } catch {
      notifications.show({ color: "red", message: "Could not save tab order" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Group gap="xs" wrap="nowrap" align="center">
      <Box style={{ flex: 1, minWidth: 0, overflowX: "auto" }}>
        <SegmentedControl
          value={value}
          onChange={(v) => onChange(v as FeedTabKey)}
          data={data}
          color="ember"
          radius="sm"
          size="sm"
          fullWidth
        />
      </Box>

      {isAdmin && (
        <Popover
          opened={reorderOpen}
          onChange={setReorderOpen}
          position="bottom-end"
          withArrow
          shadow="md"
          onOpen={() => setDraft(order)}
        >
          <Popover.Target>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              onClick={() => setReorderOpen((o) => !o)}
              aria-label="Reorder tabs"
              title="Reorder tabs"
            >
              <Settings2 size={18} />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap="xs" w={220}>
              <Text size="xs" fw={700} tt="uppercase" lts={0.5} c="dimmed">
                Reorder feed tabs
              </Text>
              {draft.map((key, i) => (
                <Group key={key} justify="space-between" gap="xs">
                  <Text size="sm">{TAB_LABELS[key]}</Text>
                  <Group gap={2}>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="gray"
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                      aria-label="Move up"
                    >
                      <ChevronUp size={15} />
                    </ActionIcon>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="gray"
                      disabled={i === draft.length - 1}
                      onClick={() => move(i, 1)}
                      aria-label="Move down"
                    >
                      <ChevronDown size={15} />
                    </ActionIcon>
                  </Group>
                </Group>
              ))}
              <Button size="xs" color="ember" loading={saving} onClick={saveOrder}>
                Save order
              </Button>
            </Stack>
          </Popover.Dropdown>
        </Popover>
      )}
    </Group>
  );
}
