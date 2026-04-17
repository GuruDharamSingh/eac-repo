"use client";

import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  Paper,
  Stack,
  Textarea,
  TextInput,
  Text,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import type { ContentDraft, WorkshopSessionDraft } from "../types";

interface WorkshopTierProps {
  draft: ContentDraft;
  onChange: (patch: Partial<ContentDraft>) => void;
}

export function WorkshopTier({ draft, onChange }: WorkshopTierProps) {
  const sessions = draft.sessions ?? [];

  const addSession = () => {
    const next: WorkshopSessionDraft = {
      id: `sess_${Date.now()}`,
      title: "",
      orderIndex: sessions.length,
    };
    onChange({ sessions: [...sessions, next] });
  };

  const updateSession = (id: string, patch: Partial<WorkshopSessionDraft>) => {
    onChange({
      sessions: sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  };

  const removeSession = (id: string) => {
    onChange({ sessions: sessions.filter((s) => s.id !== id) });
  };

  return (
    <Stack gap="md">
      <Textarea
        label="The pitch"
        description="The full story — why someone should join."
        autosize
        minRows={4}
        value={draft.pitch ?? ""}
        onChange={(e) => onChange({ pitch: e.currentTarget.value || null })}
      />
      <Group grow>
        <NumberInput
          label="Price"
          prefix="$"
          min={0}
          value={draft.price ?? ""}
          onChange={(v) => onChange({ price: v === "" ? null : Number(v) })}
        />
        <TextInput
          label="Flyer image URL"
          placeholder="https://..."
          value={draft.flyerUrl ?? ""}
          onChange={(e) => onChange({ flyerUrl: e.currentTarget.value || null })}
        />
      </Group>

      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={500}>Sessions</Text>
          <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={addSession}>
            Add session
          </Button>
        </Group>
        {sessions.length === 0 && (
          <Text size="xs" c="dimmed">
            No sessions yet. One session is enough to promote this to a workshop.
          </Text>
        )}
        {sessions.map((s, i) => (
          <Paper key={s.id} withBorder p="sm" radius="sm">
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Session {i + 1}
                </Text>
                <ActionIcon color="red" variant="subtle" onClick={() => removeSession(s.id)}>
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
              <TextInput
                placeholder="Session title"
                value={s.title}
                onChange={(e) => updateSession(s.id, { title: e.currentTarget.value })}
              />
              <Textarea
                placeholder="What happens in this session?"
                autosize
                minRows={2}
                value={s.description ?? ""}
                onChange={(e) => updateSession(s.id, { description: e.currentTarget.value })}
              />
              <Group grow>
                <TextInput
                  type="datetime-local"
                  label="When"
                  value={s.scheduledAt ?? ""}
                  onChange={(e) => updateSession(s.id, { scheduledAt: e.currentTarget.value })}
                />
                <NumberInput
                  label="Duration (min)"
                  min={0}
                  value={s.durationMinutes ?? ""}
                  onChange={(v) =>
                    updateSession(s.id, { durationMinutes: v === "" ? undefined : Number(v) })
                  }
                />
              </Group>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Stack>
  );
}
