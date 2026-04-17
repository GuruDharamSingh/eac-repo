"use client";

import { Badge, Group, Menu, Text } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import type { ThreadKind } from "../types";

const KIND_COLOR: Record<ThreadKind, string> = {
  post: "gray",
  meeting: "ember",
  event: "orange",
  workshop: "grape",
};

const KIND_LABEL: Record<ThreadKind, string> = {
  post: "Post",
  meeting: "Meeting",
  event: "Event",
  workshop: "Workshop",
};

interface KindBadgeProps {
  kind: ThreadKind;
  reason?: string;
  onOverride?: (kind: ThreadKind) => void;
}

export function KindBadge({ kind, reason, onOverride }: KindBadgeProps) {
  const badge = (
    <Badge
      color={KIND_COLOR[kind]}
      variant="light"
      size="lg"
      rightSection={onOverride ? <IconChevronDown size={12} /> : null}
      style={{ cursor: onOverride ? "pointer" : "default", textTransform: "none" }}
    >
      Publishing as {KIND_LABEL[kind]}
    </Badge>
  );

  if (!onOverride) {
    return (
      <Group gap="xs">
        {badge}
        {reason && (
          <Text size="xs" c="dimmed">
            {reason}
          </Text>
        )}
      </Group>
    );
  }

  return (
    <Group gap="xs">
      <Menu position="top-start" width={200}>
        <Menu.Target>{badge}</Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Override kind</Menu.Label>
          {(Object.keys(KIND_LABEL) as ThreadKind[]).map((k) => (
            <Menu.Item key={k} onClick={() => onOverride(k)} disabled={k === kind}>
              {KIND_LABEL[k]}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
      {reason && (
        <Text size="xs" c="dimmed">
          {reason}
        </Text>
      )}
    </Group>
  );
}
