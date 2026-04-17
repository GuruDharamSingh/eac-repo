"use client";

import { Group, NumberInput, Stack, Switch, TextInput } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import type { ContentDraft } from "../types";

interface ScheduleTierProps {
  draft: ContentDraft;
  onChange: (patch: Partial<ContentDraft>) => void;
}

export function ScheduleTier({ draft, onChange }: ScheduleTierProps) {
  return (
    <Stack gap="sm">
      <Switch
        label="Mark as a meeting"
        description="Even without a confirmed time. Use this if the date is TBD."
        checked={draft.isMeeting}
        onChange={(e) => onChange({ isMeeting: e.currentTarget.checked })}
      />
      <DateTimePicker
        label="Meeting time"
        placeholder="Pick a date and time"
        clearable
        value={draft.scheduledAt ? new Date(draft.scheduledAt) : null}
        onChange={(v) => onChange({ scheduledAt: v ? new Date(v as any).toISOString() : null })}
      />
      <TextInput
        label='Or label (e.g. "TBD", "next moon")'
        placeholder="Leave blank if the meeting time is set above"
        value={draft.meetingTimeLabel ?? ""}
        onChange={(e) => onChange({ meetingTimeLabel: e.currentTarget.value || null })}
      />
      <Group grow>
        <NumberInput
          label="Duration (minutes)"
          min={0}
          value={draft.durationMinutes ?? ""}
          onChange={(v) => onChange({ durationMinutes: v === "" ? null : Number(v) })}
        />
        <TextInput
          label="Location"
          placeholder="Address, room, or 'online'"
          value={draft.location ?? ""}
          onChange={(e) => onChange({ location: e.currentTarget.value || null })}
        />
      </Group>
      <Switch
        label="This meeting is online"
        checked={!!draft.isOnline}
        onChange={(e) => onChange({ isOnline: e.currentTarget.checked })}
      />
    </Stack>
  );
}
