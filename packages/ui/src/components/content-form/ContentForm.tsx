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
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  UnstyledButton,
  ActionIcon,
} from "@mantine/core";
import { RichTextEditor } from "../RichTextEditor";
import { DateTimePicker } from "@mantine/dates";
import {
  IconAlertCircle,
  IconChevronDown,
  IconChevronRight,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import { MediaUpload } from "../MediaUpload";
import { useContentDraft } from "@elkdonis/hooks";
import type { ContentFormProps } from "./types";

export function ContentForm({
  orgId,
  userId,
  isAdmin = false,
  initialDraft,
  initialThreadId,
  onPublished,
  onSaveDraft,
}: ContentFormProps) {
  const {
    kind,
    setKind,
    draft,
    update,
    addSession,
    updateSession,
    removeSession,
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
    initialThreadId,
    onPublished,
    onSaveDraft,
  });

  const [showIntegrations, setShowIntegrations] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const sessions = draft.sessions ?? [];

  return (
    <Stack gap="md">
      {/* Kind picker */}
      <SegmentedControl
        value={kind}
        onChange={(v) => setKind(v as typeof kind)}
        data={[
          { label: "Post", value: "post" },
          { label: "Meeting", value: "meeting" },
          { label: "Workshop", value: "workshop" },
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
          placeholder={kind === "workshop" ? "The pitch — why join?" : "Write something"}
          minimal={kind === "meeting"}
        />
      </div>

      {/* Meeting fields */}
      {(kind === "meeting" || kind === "workshop") && (
        <>
          <Divider label="When & where" labelPosition="left" />
          <Group grow>
            <DateTimePicker
              label="Meeting time"
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
          <Switch
            label="This is online"
            checked={!!draft.isOnline}
            onChange={(e) => update({ isOnline: e.currentTarget.checked })}
          />
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
        </>
      )}

      {/* Workshop fields */}
      {kind === "workshop" && (
        <>
          <Divider label="Workshop" labelPosition="left" />
          <Group grow>
            <NumberInput
              label="Price"
              prefix="$"
              min={0}
              value={draft.price ?? ""}
              onChange={(v) => update({ price: v === "" ? null : Number(v) })}
            />
            <TextInput
              label="Flyer image URL"
              placeholder="https://…"
              value={draft.flyerUrl ?? ""}
              onChange={(e) => update({ flyerUrl: e.currentTarget.value || null })}
            />
          </Group>

          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={500}>Sessions</Text>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconPlus size={14} />}
                onClick={addSession}
              >
                Add session
              </Button>
            </Group>
            {sessions.length === 0 && (
              <Text size="xs" c="dimmed">
                Optional — add sessions to structure the workshop into parts.
              </Text>
            )}
            {sessions.map((s, i) => (
              <Paper key={s.id} withBorder p="sm" radius="sm">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Session {i + 1}</Text>
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
                </Stack>
              </Paper>
            ))}
          </Stack>
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
