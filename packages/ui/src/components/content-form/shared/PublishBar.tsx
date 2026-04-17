"use client";

import { Button, Group, Paper, Text } from "@mantine/core";
import { KindBadge } from "./KindBadge";
import type { ThreadKind } from "../types";

interface PublishBarProps {
  kind: ThreadKind;
  reason?: string;
  onOverride?: (kind: ThreadKind) => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  savingDraft?: boolean;
  publishing?: boolean;
  draftSavedAt?: Date | null;
}

export function PublishBar({
  kind,
  reason,
  onOverride,
  onSaveDraft,
  onPublish,
  savingDraft,
  publishing,
  draftSavedAt,
}: PublishBarProps) {
  return (
    <Paper
      withBorder
      shadow="md"
      radius="md"
      p="md"
      style={{ position: "sticky", bottom: 16, zIndex: 20, background: "rgba(255,252,244,0.96)", backdropFilter: "blur(8px)" }}
    >
      <Group justify="space-between" wrap="wrap" gap="md">
        <KindBadge kind={kind} reason={reason} onOverride={onOverride} />
        <Group gap="sm">
          {draftSavedAt && (
            <Text size="xs" c="dimmed">
              Draft saved {draftSavedAt.toLocaleTimeString()}
            </Text>
          )}
          <Button variant="subtle" onClick={onSaveDraft} loading={savingDraft}>
            Save draft
          </Button>
          <Button onClick={onPublish} loading={publishing}>
            Publish
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}
