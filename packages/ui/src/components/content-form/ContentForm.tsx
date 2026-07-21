"use client";

import {
  Alert,
  Button,
  Collapse,
  Divider,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { RichTextEditor } from "../RichTextEditor";
import { DateTimePicker } from "@mantine/dates";
import {
  IconAlertCircle,
  IconChevronDown,
  IconChevronRight,
  IconRepeat,
  IconVideo,
} from "@tabler/icons-react";
import { useState } from "react";
import { MediaUpload } from "../MediaUpload";
import { useContentDraft } from "@elkdonis/hooks";
import type { ContentFormProps } from "./types";

// Post and Meeting only — Workshop has its own dedicated page
// (/workshops/create) with a layout built for sessions/pricing/materials.
export function ContentForm({
  orgId,
  userId,
  isAdmin = false,
  initialDraft,
  initialKind,
  initialThreadId,
  onPublished,
  onSaveDraft,
}: ContentFormProps) {
  const {
    kind,
    setKind,
    draft,
    update,
    mediaFiles,
    setMediaFiles,
    libraryFiles,
    addLibraryFile,
    removeLibraryFile,
    createTalkRoom,
    setCreateTalkRoom,
    createDocument,
    setCreateDocument,
    documentUrl,
    publishing,
    savingDraft,
    error,
    setError,
    draftSavedAt,
    handlePublish,
    handleSaveDraft,
  } = useContentDraft({
    orgId,
    userId,
    initialDraft,
    initialKind,
    initialThreadId,
    onPublished,
    onSaveDraft,
  });

  const [showIntegrations, setShowIntegrations] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <Stack gap="md">
      {/* Kind picker — Workshop isn't here on purpose: it has its own
          dedicated page (/workshops/create) with a layout built specifically
          for sessions, pricing, and materials, not this shared drawer. */}
      <SegmentedControl
        value={kind}
        onChange={(v) => setKind(v as typeof kind)}
        data={[
          { label: "Post", value: "post" },
          { label: "Meeting", value: "meeting" },
        ]}
        fullWidth
      />

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" onClose={() => setError(null)} withCloseButton>
          {error}
        </Alert>
      )}

      {/* Always-visible: title + body */}
      <TextInput
        label="Title"
        placeholder="Give it a name"
        value={draft.title}
        onChange={(e) => update({ title: e.currentTarget.value })}
        required
      />
      <div>
        <Text size="sm" fw={500} mb={4}>Body</Text>
        <RichTextEditor
          content={draft.body ?? ""}
          onChange={(html) => update({ body: html })}
          placeholder="Write something"
          minimal={kind === "meeting"}
        />
      </div>

      {/* Meeting fields */}
      {kind === "meeting" && (
        <>
          <Divider label="When & where" labelPosition="left" />
          <Group grow>
            <DateTimePicker
              label={draft.recurrencePattern && draft.recurrencePattern !== "NONE" ? "Start date & time" : "Meeting time"}
              description={
                draft.recurrencePattern && draft.recurrencePattern !== "NONE"
                  ? "When the series begins — the card shows the next occurrence."
                  : undefined
              }
              placeholder="Pick a date and time"
              clearable
              dropdownType="modal"
              value={draft.scheduledAt ? new Date(draft.scheduledAt) : null}
              onChange={(v) =>
                update({ scheduledAt: v ? new Date(v as any).toISOString() : null })
              }
            />
            <NumberInput
              label="Duration (minutes)"
              min={0}
              value={draft.durationMinutes ?? ""}
              onChange={(v) => update({ durationMinutes: v === "" ? null : Number(v) })}
            />
          </Group>
          <TextInput
            label="Location"
            placeholder="Address, room, or 'online'"
            value={draft.location ?? ""}
            onChange={(e) => update({ location: e.currentTarget.value || null })}
          />
          {kind === "meeting" && (
            <TextInput
              label="Video link"
              description="Zoom, Meet, or any video URL — shown as a join button on the card"
              placeholder="https://..."
              leftSection={<IconVideo size={14} />}
              value={draft.videoLink ?? ""}
              onChange={(e) => update({ videoLink: e.currentTarget.value || null })}
            />
          )}
          <Switch
            label="This is online"
            checked={!!draft.isOnline}
            onChange={(e) => update({ isOnline: e.currentTarget.checked })}
          />

          {/* Recurring toggle */}
          <Divider label={<Group gap={4}><IconRepeat size={14} /><span>Recurring</span></Group>} labelPosition="left" />
          <Switch
            label="This is a recurring meeting"
            checked={!!draft.recurrencePattern && draft.recurrencePattern !== 'NONE'}
            onChange={(e) => {
              update({ recurrencePattern: e.currentTarget.checked ? 'WEEKLY' : 'NONE' });
              if (!e.currentTarget.checked) update({ recurrenceCustomRule: null, recurrenceUntil: null });
            }}
          />
          <Collapse in={!!draft.recurrencePattern && draft.recurrencePattern !== 'NONE'}>
            <Stack gap="sm">
              <Select
                label="Repeats"
                data={[
                  { value: 'DAILY', label: 'Daily' },
                  { value: 'WEEKLY', label: 'Weekly' },
                  { value: 'MONTHLY', label: 'Monthly' },
                  { value: 'CUSTOM', label: 'Custom…' },
                ]}
                value={draft.recurrencePattern ?? 'WEEKLY'}
                onChange={(v) => update({ recurrencePattern: (v as any) ?? 'WEEKLY' })}
              />
              {draft.recurrencePattern === 'CUSTOM' && (
                <TextInput
                  label="Custom schedule"
                  placeholder='e.g. "Every 2 weeks on Tuesday"'
                  value={draft.recurrenceCustomRule ?? ""}
                  onChange={(e) => update({ recurrenceCustomRule: e.currentTarget.value || null })}
                />
              )}
              <DateTimePicker
                label="Ends on (optional)"
                placeholder="No end date"
                clearable
                dropdownType="modal"
                value={draft.recurrenceUntil ? new Date(draft.recurrenceUntil) : null}
                onChange={(v) => update({ recurrenceUntil: v ? new Date(v as any).toISOString() : null })}
              />
            </Stack>
          </Collapse>

          <Switch
            label="Open RSVPs"
            checked={!!draft.isRsvpEnabled}
            onChange={(e) => update({ isRsvpEnabled: e.currentTarget.checked })}
          />
          {isAdmin && (
            <Switch
              label="Admin only (private)"
              description="Only admins can see this in the feed"
              checked={draft.visibility === 'ORGANIZATION'}
              onChange={(e) =>
                update({ visibility: e.currentTarget.checked ? 'ORGANIZATION' : 'PUBLIC' })
              }
            />
          )}
          {draft.isRsvpEnabled && (
            <Group grow>
              <NumberInput
                label="Attendee cap"
                min={0}
                value={draft.attendeeLimit ?? ""}
                onChange={(v) => update({ attendeeLimit: v === "" ? null : Number(v) })}
              />
              <NumberInput
                label="Min attendees"
                min={0}
                value={draft.minAttendees ?? ""}
                onChange={(v) => update({ minAttendees: v === "" ? null : Number(v) })}
              />
            </Group>
          )}
          {draft.isRsvpEnabled && (
            <Textarea
              label="RSVP confirmation email"
              description="Sent to each person when they RSVP. Leave empty to use your organization's default wording. You can refine it later from the Email Templates page."
              placeholder="Thanks for signing up! Here's what to expect…"
              autosize
              minRows={3}
              value={draft.rsvpEmailBody ?? ""}
              onChange={(e) => update({ rsvpEmailBody: e.currentTarget.value || null })}
            />
          )}
          {draft.isRsvpEnabled && (
            <NumberInput
              label="Reminder email (minutes before start)"
              description="Attendees get a 'starting soon' email this many minutes before the session. Set 0 to disable."
              min={0}
              max={10080}
              value={draft.reminderMinutesBefore ?? 60}
              onChange={(v) => update({ reminderMinutesBefore: v === "" ? null : Number(v) })}
            />
          )}
        </>
      )}

      {/* Media upload (optional, all kinds) */}
      <Divider label="Media (optional)" labelPosition="left" />
      <MediaUpload
        files={mediaFiles}
        onChange={setMediaFiles}
        enableLibrary
        orgId={orgId}
        selectedFiles={libraryFiles}
        onSelectFile={addLibraryFile}
        onRemoveSelectedFile={removeLibraryFile}
      />

      {/* Integrations drawer */}
      <UnstyledButton
        onClick={() => setShowIntegrations((v) => !v)}
        style={{ padding: "8px 0" }}
      >
        <Group gap="xs">
          {showIntegrations ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          <Text fw={500} size="sm">Integrations</Text>
          <Text size="xs" c="dimmed">Talk room, living document…</Text>
        </Group>
      </UnstyledButton>
      <Collapse in={showIntegrations}>
        <Stack gap="sm" pl="md">
          <Switch
            label="Create a Talk room"
            description="Nextcloud Talk video room attached to this thread"
            checked={createTalkRoom}
            onChange={(e) => setCreateTalkRoom(e.currentTarget.checked)}
          />
          <Switch
            label="Create a living document"
            description="Collaborative Nextcloud document linked to this thread"
            checked={createDocument}
            onChange={(e) => setCreateDocument(e.currentTarget.checked)}
          />
          {createDocument && documentUrl && (
            <Text size="xs" c="dimmed">
              Document URL: <a href={documentUrl} target="_blank" rel="noopener noreferrer">{documentUrl}</a>
            </Text>
          )}
        </Stack>
      </Collapse>

      {/* Advanced drawer */}
      <UnstyledButton
        onClick={() => setShowAdvanced((v) => !v)}
        style={{ padding: "8px 0" }}
      >
        <Group gap="xs">
          {showAdvanced ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          <Text fw={500} size="sm">Advanced</Text>
          <Text size="xs" c="dimmed">Scheduled publish…</Text>
        </Group>
      </UnstyledButton>
      <Collapse in={showAdvanced}>
        <Stack gap="sm" pl="md">
          <DateTimePicker
            label="Publish at"
            description="Leave empty to publish immediately."
            placeholder="Schedule for later"
            clearable
            dropdownType="modal"
            value={draft.publishAt ? new Date(draft.publishAt) : null}
            onChange={(v) =>
              update({ publishAt: v ? new Date(v as any).toISOString() : null })
            }
          />
        </Stack>
      </Collapse>

      {/* Publish bar */}
      <Paper
        withBorder
        shadow="md"
        radius="md"
        p="md"
        style={{ position: "sticky", bottom: 16, zIndex: 20, background: "rgba(255,252,244,0.96)", backdropFilter: "blur(8px)" }}
      >
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Publishing as <b>{kind}</b>
            {draftSavedAt && ` · draft saved ${draftSavedAt.toLocaleTimeString()}`}
          </Text>
          <Group gap="sm">
            <Button variant="subtle" onClick={handleSaveDraft} loading={savingDraft}>
              Save draft
            </Button>
            <Button onClick={handlePublish} loading={publishing}>
              Publish
            </Button>
          </Group>
        </Group>
      </Paper>
    </Stack>
  );
}
