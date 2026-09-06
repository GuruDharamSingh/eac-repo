"use client";

import { useEffect, useState } from "react";
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
  SegmentedControl,
  ColorInput,
  Slider,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { Dropzone } from "@mantine/dropzone";
import { Plus, Trash2, ArrowLeft, Upload as UploadIcon, FileText, X } from "lucide-react";
import { useContentDraft } from "@elkdonis/hooks";
import { RichTextEditor, RsvpTier, SingleImageField, WorkshopMaterials } from "@elkdonis/ui";
import type { ContentDraft, WorkshopSessionDraft, WorkshopSessionResource } from "@elkdonis/types";

// ============================================================================
// Dedicated, full-page workshop creation/edit experience — distinct from the
// generic post/meeting drawer on purpose. Uses the same useContentDraft hook
// (and so the same /api/content endpoint + workshop_pages/workshop_sessions
// tables) as the drawer, just with its own spacious layout built specifically
// around what a workshop needs: pitch, price, media slots, sessions with real
// entry fields, workshop emails, and — once saved — the materials folder.
//
// This is also the single editing surface for everything that used to live
// in the separate "Edit page" drawer (workshop-owner-editor.tsx, now
// removed) — banner/hero media and hero text live here too, so there's only
// ever one place to edit a workshop.
// ============================================================================

interface WorkshopCreatePageProps {
  orgId: string;
  userId: string;
  initialThreadId?: string;
  initialDraft?: Partial<ContentDraft>;
}

function mediaTypeToResourceType(mediaType: string): WorkshopSessionResource["type"] {
  if (mediaType === "video") return "video";
  if (mediaType === "audio") return "audio";
  if (mediaType === "document") return "doc";
  return "other";
}

async function uploadSessionFile(file: File, userId: string): Promise<WorkshopSessionResource> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("userId", userId);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) throw new Error(`Failed to upload ${file.name}`);
  const json = await res.json();
  if (!json?.url) throw new Error("Invalid upload response");
  return {
    id: json.fileId ?? `res_${Date.now()}`,
    title: json.filename ?? file.name,
    type: mediaTypeToResourceType(json.mediaType),
    url: json.url,
    isPublic: false,
  };
}

interface SessionEditorCardProps {
  session: WorkshopSessionDraft;
  index: number;
  orgId: string;
  userId: string;
  onUpdate: (patch: Partial<WorkshopSessionDraft>) => void;
  onRemove: () => void;
}

function SessionEditorCard({ session: s, index: i, orgId, userId, onUpdate, onRemove }: SessionEditorCardProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const resources = s.resources ?? [];

  const handleDrop = async (dropped: File[]) => {
    const file = dropped[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const resource = await uploadSessionFile(file, userId);
      onUpdate({ resources: [...resources, resource] });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeResource = (id: string) => {
    onUpdate({ resources: resources.filter((r) => r.id !== id) });
  };

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={600} size="sm" c="dimmed">Session {i + 1}</Text>
          <ActionIcon color="red" variant="subtle" onClick={onRemove}>
            <Trash2 size={16} />
          </ActionIcon>
        </Group>
        <TextInput
          label="Title"
          placeholder="e.g. Opening Circle"
          value={s.title}
          onChange={(e) => onUpdate({ title: e.currentTarget.value })}
        />
        <Textarea
          label="Description"
          placeholder="What happens in this session?"
          autosize
          minRows={2}
          value={s.description ?? ""}
          onChange={(e) => onUpdate({ description: e.currentTarget.value })}
        />
        <Group grow>
          <DateTimePicker
            label="Date & time"
            placeholder="Optional"
            clearable
            dropdownType="modal"
            value={s.scheduledAt ? new Date(s.scheduledAt) : null}
            onChange={(v) => onUpdate({ scheduledAt: v ? new Date(v).toISOString() : undefined })}
          />
          <NumberInput
            label="Duration (minutes)"
            min={15}
            max={480}
            step={15}
            value={s.durationMinutes ?? 90}
            onChange={(v) => onUpdate({ durationMinutes: v === "" ? undefined : Number(v) })}
          />
        </Group>
        <Switch
          label="Online"
          description={s.isOnline ?? true ? "Uses the workshop's Talk room" : undefined}
          checked={s.isOnline ?? true}
          onChange={(e) => onUpdate({ isOnline: e.currentTarget.checked })}
        />
        {!(s.isOnline ?? true) && (
          <TextInput
            label="In-person location"
            placeholder="Studio address or space name"
            value={s.location ?? ""}
            onChange={(e) => onUpdate({ location: e.currentTarget.value })}
          />
        )}
        <SingleImageField
          label="Session image"
          value={s.mediaUrl}
          onChange={(url) => onUpdate({ mediaUrl: url })}
          orgId={orgId}
        />
        <TextInput
          label="Session video"
          description="A recorded or embedded video for this session — separate from the shared live Talk room"
          placeholder="https://…"
          value={s.videoUrl ?? ""}
          onChange={(e) => onUpdate({ videoUrl: e.currentTarget.value || null })}
        />
        <ColorInput
          label="Session background color"
          description="Leave blank to use the default status color"
          placeholder="Default"
          value={s.backgroundColor ?? ""}
          onChange={(v) => onUpdate({ backgroundColor: v || null })}
        />
        <div>
          <Text size="sm" fw={500} mb={4}>Materials</Text>
          {resources.length > 0 && (
            <Stack gap={4} mb="xs">
              {resources.map((r) => (
                <Group key={r.id} gap="xs" wrap="nowrap">
                  <FileText size={14} color="#9a7650" style={{ flexShrink: 0 }} />
                  <Text size="sm" style={{ flex: 1, minWidth: 0 }} truncate>{r.title}</Text>
                  <ActionIcon size="sm" color="red" variant="subtle" onClick={() => removeResource(r.id)}>
                    <X size={14} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
          )}
          <Dropzone onDrop={handleDrop} loading={uploading} maxSize={200 * 1024 * 1024} p="xs">
            <Group justify="center" gap="sm" mih={40} style={{ pointerEvents: "none" }}>
              <UploadIcon size={16} color="#9a7650" />
              <Text size="sm" c="dimmed">Drop a file or click to add session materials</Text>
            </Group>
          </Dropzone>
          {uploadError && <Text size="xs" c="red" mt={4}>{uploadError}</Text>}
        </div>
      </Stack>
    </Paper>
  );
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
  const heroType = draft.heroMediaType ?? "image";

  // Next's client-router navigation doesn't always reset scroll before this
  // (much shorter) page mounts, so the sticky site header can re-pin partway
  // down — visually covering the Title field until the user scrolls up.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <Box style={{ background: "#fffaf0", minHeight: "100vh", paddingBottom: 120 }}>
      <Container size="sm" pt={48} pb="xl">
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
              <div>
                <Text size="sm" fw={500} mb={4}>RSVP settings</Text>
                <Text size="xs" c="dimmed" mb={8}>
                  Joining is always open via the Join Workshop button below — these just cap or time-box it.
                </Text>
                <RsvpTier draft={draft} onChange={update} hideEnabledToggle />
              </div>
              <ColorInput
                label="Workshop background color"
                description="The page background for this workshop. Leave blank for the site default."
                placeholder="Default"
                value={draft.backgroundColor ?? ""}
                onChange={(v) => update({ backgroundColor: v || null })}
              />
              <Switch
                label="Create a Talk room"
                description="One video room shared by the whole workshop — every session joins through it, no separate links needed"
                checked={createTalkRoom}
                onChange={(e) => setCreateTalkRoom(e.currentTarget.checked)}
              />
            </Stack>
          </Paper>

          <Paper withBorder radius="md" p="lg">
            <Stack gap="md">
              <Text fw={600} size="sm">Media</Text>
              <SingleImageField
                label="Banner image"
                description="This is the header — a wide strip cropped to 300px tall, full width. Aim for at least 1600×500px (roughly 3:1) with the important part of the photo centered vertically, since the top and bottom get cropped off on most screens. Falls back to the card thumbnail."
                value={draft.bannerImageUrl}
                onChange={(url) => update({ bannerImageUrl: url })}
                orgId={orgId}
              />
              {draft.bannerImageUrl && (
                <Stack gap={6}>
                  <Box style={{ borderRadius: 8, overflow: "hidden", height: 130 }}>
                    <img
                      src={draft.bannerImageUrl}
                      alt="Banner preview"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition: `center ${draft.bannerFocalY ?? 50}%`,
                        display: "block",
                      }}
                    />
                  </Box>
                  <Text size="xs" c="dimmed">Preview of the header crop — drag to move the visible part up or down</Text>
                  <Slider
                    value={draft.bannerFocalY ?? 50}
                    onChange={(v) => update({ bannerFocalY: v })}
                    min={0}
                    max={100}
                    label={(v) => (v === 0 ? "Top" : v === 100 ? "Bottom" : v === 50 ? "Center" : `${v}%`)}
                  />
                </Stack>
              )}
              <Stack gap={4}>
                <SegmentedControl
                  value={heroType}
                  onChange={(v) => update({ heroMediaType: v as "image" | "video" })}
                  data={[
                    { label: "Hero image", value: "image" },
                    { label: "Hero video", value: "video" },
                  ]}
                  w={260}
                />
                {heroType === "video" ? (
                  <TextInput
                    label="Main media (hero) — video URL"
                    description="Video URL (mp4 or hosted embed) shown in the page body"
                    placeholder="https://…"
                    value={draft.heroMediaUrl ?? ""}
                    onChange={(e) => update({ heroMediaUrl: e.currentTarget.value || null })}
                  />
                ) : (
                  <SingleImageField
                    label="Main media (hero)"
                    description="Featured image shown in the page body"
                    value={draft.heroMediaUrl}
                    onChange={(url) => update({ heroMediaUrl: url })}
                    orgId={orgId}
                  />
                )}
              </Stack>
              <TextInput
                label="Hero text"
                description="Headline shown across the hero media"
                placeholder="Optional"
                value={draft.heroText ?? ""}
                onChange={(e) => update({ heroText: e.currentTarget.value || null })}
              />
              <SingleImageField
                label="Card thumbnail"
                description="Shown on feed and workshop cards"
                value={draft.flyerUrl}
                onChange={(url) => update({ flyerUrl: url })}
                orgId={orgId}
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
                <SessionEditorCard
                  key={s.id}
                  session={s}
                  index={i}
                  orgId={orgId}
                  userId={userId}
                  onUpdate={(patch) => updateSession(s.id, patch)}
                  onRemove={() => removeSession(s.id)}
                />
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

          <div>
            <Title order={4} mb="sm" style={{ fontFamily: "'Cinzel', serif", color: "#3d1f04" }}>
              Workshop emails
            </Title>
            <Paper withBorder radius="md" p="lg">
              <Stack gap="md">
                <Textarea
                  label="Welcome email"
                  description="Sent when someone joins — include what to expect. The materials folder link is added automatically."
                  placeholder="Welcome! Here's what to expect…"
                  autosize
                  minRows={3}
                  value={draft.rsvpEmailBody ?? ""}
                  onChange={(e) => update({ rsvpEmailBody: e.currentTarget.value })}
                />
                <Textarea
                  label="Reminder email"
                  description="Sent before the workshop starts, based on the reminder window below."
                  placeholder="Looking forward to seeing you soon…"
                  autosize
                  minRows={3}
                  value={draft.reminderEmailBody ?? ""}
                  onChange={(e) => update({ reminderEmailBody: e.currentTarget.value })}
                />
                <NumberInput
                  label="Send reminder how many minutes before?"
                  min={5}
                  max={10080}
                  step={5}
                  value={draft.reminderMinutesBefore ?? 60}
                  onChange={(v) => update({ reminderMinutesBefore: v === "" ? 60 : Number(v) })}
                />
              </Stack>
            </Paper>
          </div>
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
            {draftSavedAt ? `Draft saved ${draftSavedAt.toLocaleTimeString()}` : " "}
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
