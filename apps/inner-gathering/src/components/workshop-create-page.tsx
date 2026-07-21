"use client";

import { useRouter } from "next/navigation";
import {
  Box,
  Container,
  Title,
  Text,
  Stack,
  Paper,
  TextInput,
  Textarea,
  NumberInput,
  Button,
  Group,
  ActionIcon,
  Divider,
  Switch,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { useContentDraft } from "@elkdonis/hooks";
import { RichTextEditor, SingleImageField, WorkshopMaterials } from "@elkdonis/ui";
import type { ContentDraft } from "@elkdonis/types";

// ============================================================================
// Dedicated, full-page workshop creation/edit experience — distinct from the
// generic post/meeting drawer on purpose. Uses the same useContentDraft hook
// (and so the same /api/content endpoint + workshop_pages/workshop_sessions
// tables) as the drawer, just with its own spacious layout built specifically
// around what a workshop needs: pitch, price, flyer, sessions with real
// entry fields, and — once saved — the materials folder.
// ============================================================================

interface WorkshopCreatePageProps {
  orgId: string;
  userId: string;
  initialThreadId?: string;
  initialDraft?: Partial<ContentDraft>;
}

export function WorkshopCreatePage({ orgId, userId, initialThreadId, initialDraft }: WorkshopCreatePageProps) {
  const router = useRouter();
  const {
    threadId,
    draft,
    update,
    addSession,
    updateSession,
    removeSession,
    createTalkRoom,
    setCreateTalkRoom,
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
    initialKind: "workshop",
    initialThreadId,
    onPublished: (id) => router.push(`/workshops/${id}`),
  });

  const sessions = draft.sessions ?? [];

  return (
    <Box style={{ background: "#fffaf0", minHeight: "100vh", paddingBottom: 120 }}>
      <Container size="sm" py="xl">
        <Stack gap="xl">
          <Group gap="xs">
            <ActionIcon variant="subtle" color="gray" onClick={() => router.back()}>
              <ArrowLeft size={18} />
            </ActionIcon>
            <div>
              <Text size="xs" fw={700} tt="uppercase" c="dimmed" lts={1}>
                Workshop
              </Text>
              <Title order={2} style={{ fontFamily: "'Cinzel', serif", color: "#3d1f04" }}>
                {threadId ? "Edit Workshop" : "Create a Workshop"}
              </Title>
            </div>
          </Group>

          {error && (
            <Text c="red" size="sm">{error}</Text>
          )}

          <Paper withBorder radius="md" p="lg">
            <Stack gap="md">
              <TextInput
                label="Title"
                placeholder="Give your workshop a name"
                required
                value={draft.title}
                onChange={(e) => update({ title: e.currentTarget.value })}
              />
              <div>
                <Text size="sm" fw={500} mb={4}>Pitch</Text>
                <RichTextEditor
                  content={draft.body ?? ""}
                  onChange={(html) => update({ body: html })}
                  placeholder="Why should someone join?"
                />
              </div>
              <NumberInput
                label="Price"
                prefix="$"
                min={0}
                value={draft.price ?? ""}
                onChange={(v) => update({ price: v === "" ? null : Number(v) })}
              />
              <SingleImageField
                label="Flyer image"
                value={draft.flyerUrl}
                onChange={(url) => update({ flyerUrl: url })}
                orgId={orgId}
              />
              <Switch
                label="Create a Talk room"
                description="One video room shared by the whole workshop — every session joins through it, no separate links needed"
                checked={createTalkRoom}
                onChange={(e) => setCreateTalkRoom(e.currentTarget.checked)}
              />
            </Stack>
          </Paper>

          <div>
            <Group justify="space-between" mb="sm">
              <Title order={4} style={{ fontFamily: "'Cinzel', serif", color: "#3d1f04" }}>
                Sessions
              </Title>
              <Button size="xs" variant="light" leftSection={<Plus size={14} />} onClick={addSession}>
                Add session
              </Button>
            </Group>
            {sessions.length === 0 && (
              <Text size="sm" c="dimmed">No sessions yet — add one to structure the workshop.</Text>
            )}
            <Stack gap="md">
              {sessions.map((s, i) => (
                <Paper key={s.id} withBorder radius="md" p="md">
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text fw={600} size="sm" c="dimmed">Session {i + 1}</Text>
                      <ActionIcon color="red" variant="subtle" onClick={() => removeSession(s.id)}>
                        <Trash2 size={16} />
                      </ActionIcon>
                    </Group>
                    <TextInput
                      label="Title"
                      placeholder="e.g. Opening Circle"
                      value={s.title}
                      onChange={(e) => updateSession(s.id, { title: e.currentTarget.value })}
                    />
                    <Textarea
                      label="Description"
                      placeholder="What happens in this session?"
                      autosize
                      minRows={2}
                      value={s.description ?? ""}
                      onChange={(e) => updateSession(s.id, { description: e.currentTarget.value })}
                    />
                    <Group grow>
                      <DateTimePicker
                        label="Date & time"
                        placeholder="Optional"
                        clearable
                        dropdownType="modal"
                        value={s.scheduledAt ? new Date(s.scheduledAt) : null}
                        onChange={(v) => updateSession(s.id, { scheduledAt: v ? new Date(v).toISOString() : undefined })}
                      />
                      <NumberInput
                        label="Duration (minutes)"
                        min={15}
                        max={480}
                        step={15}
                        value={s.durationMinutes ?? 90}
                        onChange={(v) => updateSession(s.id, { durationMinutes: v === "" ? undefined : Number(v) })}
                      />
                    </Group>
                    <Switch
                      label="Online"
                      description={s.isOnline ?? true ? "Uses the workshop's Talk room" : undefined}
                      checked={s.isOnline ?? true}
                      onChange={(e) => updateSession(s.id, { isOnline: e.currentTarget.checked })}
                    />
                    {!(s.isOnline ?? true) && (
                      <TextInput
                        label="In-person location"
                        placeholder="Studio address or space name"
                        value={s.location ?? ""}
                        onChange={(e) => updateSession(s.id, { location: e.currentTarget.value })}
                      />
                    )}
                    <SingleImageField
                      label="Session image"
                      value={s.mediaUrl}
                      onChange={(url) => updateSession(s.id, { mediaUrl: url })}
                      orgId={orgId}
                    />
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </div>

          <Divider label="Materials" labelPosition="left" />
          {threadId ? (
            <WorkshopMaterials workshopId={threadId} />
          ) : (
            <Text size="sm" c="dimmed">
              Save as a draft to create the materials folder — it'll appear here right after, no reload needed.
            </Text>
          )}
        </Stack>
      </Container>

      <Paper
        withBorder
        shadow="md"
        radius="md"
        p="md"
        style={{
          position: "sticky",
          bottom: 16,
          margin: "0 auto",
          maxWidth: 640,
          zIndex: 20,
          background: "rgba(255,250,240,0.96)",
          backdropFilter: "blur(8px)",
        }}
      >
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {draftSavedAt ? `Draft saved ${draftSavedAt.toLocaleTimeString()}` : " "}
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
    </Box>
  );
}
