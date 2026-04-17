"use client";

import { Stack, TextInput, Textarea, Text } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import type { ContentDraft } from "../types";

interface PostTierProps {
  draft: ContentDraft;
  onChange: (patch: Partial<ContentDraft>) => void;
}

export function PostTier({ draft, onChange }: PostTierProps) {
  return (
    <Stack gap="sm">
      <TextInput
        label="Title"
        placeholder="Give it a name"
        value={draft.title}
        onChange={(e) => onChange({ title: e.currentTarget.value })}
        required
      />
      <Textarea
        label="Body"
        placeholder="Write something"
        autosize
        minRows={4}
        value={draft.body}
        onChange={(e) => onChange({ body: e.currentTarget.value })}
      />
      <DateTimePicker
        label="Publish at (optional)"
        description="Leave empty to publish immediately."
        placeholder="Schedule for later"
        clearable
        value={draft.publishAt ? new Date(draft.publishAt) : null}
        onChange={(v) => onChange({ publishAt: v ? new Date(v as any).toISOString() : null })}
      />
      <Text size="xs" c="dimmed">
        A time-stamp is written automatically on publish.
      </Text>
    </Stack>
  );
}
