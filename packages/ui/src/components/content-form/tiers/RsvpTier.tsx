"use client";

import { Group, NumberInput, Stack, Switch } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import type { ContentDraft } from "../types";

interface RsvpTierProps {
  draft: ContentDraft;
  onChange: (patch: Partial<ContentDraft>) => void;
}

export function RsvpTier({ draft, onChange }: RsvpTierProps) {
  return (
    <Stack gap="sm">
      <Switch
        label="Open RSVPs"
        checked={!!draft.isRsvpEnabled}
        onChange={(e) => onChange({ isRsvpEnabled: e.currentTarget.checked })}
      />
      <Group grow>
        <NumberInput
          label="Attendee cap"
          min={0}
          value={draft.attendeeLimit ?? ""}
          onChange={(v) => onChange({ attendeeLimit: v === "" ? null : Number(v) })}
        />
        <NumberInput
          label="Minimum attendees"
          min={0}
          value={draft.minAttendees ?? ""}
          onChange={(v) => onChange({ minAttendees: v === "" ? null : Number(v) })}
        />
      </Group>
      <DateTimePicker
        label="RSVP deadline"
        placeholder="When do RSVPs close?"
        clearable
        value={draft.rsvpDeadline ? new Date(draft.rsvpDeadline) : null}
        onChange={(v) => onChange({ rsvpDeadline: v ? new Date(v as any).toISOString() : null })}
      />
    </Stack>
  );
}
