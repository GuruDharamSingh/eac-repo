"use client";

import React, { useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
  rem,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Save, Eye, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { RichTextEditor } from "@elkdonis/ui";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionDraft {
  _key: string;
  title: string;
  description: string;
  scheduledAt: string;
  durationMinutes: number;
  isOnline: boolean;
  location: string;
  videoConferenceUrl: string;
  orderIndex: number;
}

interface WorkshopDraft {
  title: string;
  description: string;
  price: number | "";
  coverImageUrl: string;
  nextcloudTalkToken: string;
  sessions: SessionDraft[];
  status: "draft" | "published";
}

function blankSession(orderIndex: number): SessionDraft {
  return {
    _key: crypto.randomUUID(),
    title: "",
    description: "",
    scheduledAt: "",
    durationMinutes: 90,
    isOnline: true,
    location: "",
    videoConferenceUrl: "",
    orderIndex,
  };
}

// ─── Session Panel ────────────────────────────────────────────────────────────

function SessionPanel({
  session,
  index,
  onChange,
  onRemove,
}: {
  session: SessionDraft;
  index: number;
  onChange: (updated: SessionDraft) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(index === 0);

  const set = <K extends keyof SessionDraft>(k: K, v: SessionDraft[K]) =>
    onChange({ ...session, [k]: v });

  return (
    <Paper withBorder radius="md" style={{ borderLeft: "4px solid var(--mantine-color-orange-6)" }}>
      <Group p="sm" justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1 }}>
          <GripVertical size={16} color="var(--mantine-color-gray-5)" />
          <Box
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              backgroundColor: "var(--mantine-color-orange-6)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "0.8rem",
              flexShrink: 0,
            }}
          >
            {index + 1}
          </Box>
          <Text fw={600} size="sm" style={{ flex: 1 }} lineClamp={1}>
            {session.title || `Session ${index + 1}`}
          </Text>
        </Group>
        <Group gap="xs">
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </ActionIcon>
          <ActionIcon variant="subtle" color="red" onClick={onRemove}>
            <Trash2 size={16} />
          </ActionIcon>
        </Group>
      </Group>

      {open && (
        <>
          <Divider />
          <Stack gap="sm" p="md">
            <TextInput
              label="Session title"
              placeholder="e.g. Opening Ritual & Intentions"
              required
              value={session.title}
              onChange={(e) => set("title", e.currentTarget.value)}
            />
            <Textarea
              label="Description"
              placeholder="What will participants learn or experience?"
              rows={3}
              value={session.description}
              onChange={(e) => set("description", e.currentTarget.value)}
            />
            <Group grow>
              <TextInput
                label="Date & time"
                type="datetime-local"
                value={session.scheduledAt}
                onChange={(e) => set("scheduledAt", e.currentTarget.value)}
              />
              <NumberInput
                label="Duration (minutes)"
                min={15}
                max={480}
                step={15}
                value={session.durationMinutes}
                onChange={(v) => set("durationMinutes", Number(v))}
              />
            </Group>
            <Switch
              label="Online session"
              checked={session.isOnline}
              onChange={(e) => set("isOnline", e.currentTarget.checked)}
            />
            {session.isOnline ? (
              <TextInput
                label="Video conference link"
                placeholder="https://zoom.us/j/... or Nextcloud Meet link"
                value={session.videoConferenceUrl}
                onChange={(e) => set("videoConferenceUrl", e.currentTarget.value)}
              />
            ) : (
              <TextInput
                label="In-person location"
                placeholder="Studio address or space name"
                value={session.location}
                onChange={(e) => set("location", e.currentTarget.value)}
              />
            )}
          </Stack>
        </>
      )}
    </Paper>
  );
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

interface WorkshopEditorProps {
  initial?: Partial<WorkshopDraft>;
  workshopId?: string;
}

export function WorkshopEditor({ initial, workshopId }: WorkshopEditorProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<WorkshopDraft>({
    initialValues: {
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      price: initial?.price ?? 0,
      coverImageUrl: initial?.coverImageUrl ?? "",
      nextcloudTalkToken: initial?.nextcloudTalkToken ?? "",
      sessions: initial?.sessions ?? [blankSession(0)],
      status: initial?.status ?? "draft",
    },
    validate: {
      title: (v) => (v.trim().length < 3 ? "Title must be at least 3 characters" : null),
    },
  });

  const addSession = () => {
    form.setFieldValue("sessions", [
      ...form.values.sessions,
      blankSession(form.values.sessions.length),
    ]);
  };

  const removeSession = (key: string) => {
    form.setFieldValue(
      "sessions",
      form.values.sessions
        .filter((s) => s._key !== key)
        .map((s, i) => ({ ...s, orderIndex: i }))
    );
  };

  const updateSession = (key: string, updated: SessionDraft) => {
    form.setFieldValue(
      "sessions",
      form.values.sessions.map((s) => (s._key === key ? updated : s))
    );
  };

  const handleSave = async (publish = false) => {
    const result = form.validate();
    if (result.hasErrors) return;

    setSaving(true);
    setError(null);

    const payload = {
      ...form.values,
      status: publish ? "published" : "draft",
    };

    try {
      const url = workshopId ? `/api/workshops/${workshopId}` : "/api/workshops";
      const method = workshopId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Save failed");
      }

      const data = await res.json();
      const id = data.workshop?.id ?? workshopId;
      router.push(`/workshops/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box style={{ background: "#fffaf0", minHeight: "100vh", paddingBottom: rem(80) }}>
      <Box
        style={{
          background: "white",
          borderBottom: "1px solid var(--mantine-color-gray-3)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
        px="md"
        py="sm"
      >
        <Group justify="space-between" maw={760} mx="auto">
          <Group gap="sm">
            <Title order={4} style={{ fontFamily: "'Cinzel', serif", color: "#3d1f04" }}>
              {workshopId ? "Edit Workshop" : "New Workshop"}
            </Title>
            <Badge
              color={form.values.status === "published" ? "teal" : "gray"}
              variant="light"
              size="sm"
            >
              {form.values.status}
            </Badge>
          </Group>
          <Group gap="xs">
            <Button
              variant="subtle"
              size="sm"
              leftSection={<Eye size={15} />}
              disabled={!workshopId}
              component="a"
              href={workshopId ? `/workshops/${workshopId}` : "#"}
            >
              Preview
            </Button>
            <Button
              variant="default"
              size="sm"
              leftSection={<Save size={15} />}
              loading={saving}
              onClick={() => handleSave(false)}
            >
              Save draft
            </Button>
            <Button
              size="sm"
              color="orange"
              leftSection={<Send size={15} />}
              loading={saving}
              onClick={() => handleSave(true)}
            >
              Publish
            </Button>
          </Group>
        </Group>
      </Box>

      <Box maw={760} mx="auto" px="md" pt="xl">
        {error && (
          <Paper p="sm" mb="md" withBorder style={{ borderColor: "var(--mantine-color-red-5)", background: "#fff5f5" }}>
            <Text size="sm" c="red">{error}</Text>
          </Paper>
        )}

        <Stack gap="xl">
          {/* ── Workshop info ── */}
          <Paper withBorder radius="lg" p="xl" bg="white">
            <Stack gap="md">
              <Text fw={700} tt="uppercase" size="xs" lts={1} c="dimmed">Workshop Details</Text>
              <TextInput
                label="Title"
                placeholder="Give your workshop a compelling name"
                required
                {...form.getInputProps("title")}
              />
              <Box>
                <Text size="sm" fw={500} mb={4}>Description</Text>
                <Text size="xs" c="dimmed" mb={6}>
                  Use the editor to write rich HTML content — headings, lists, images, links. This is what participants will see on the workshop page.
                </Text>
                <Paper withBorder radius="sm">
                  <RichTextEditor
                    content={form.values.description}
                    onChange={(v) => form.setFieldValue("description", v)}
                    placeholder="What will participants learn? Who is it for? What makes this workshop special?"
                  />
                </Paper>
              </Box>
              <Group grow>
                <NumberInput
                  label="Price (CAD)"
                  placeholder="0 for free"
                  min={0}
                  prefix="$"
                  decimalScale={2}
                  {...form.getInputProps("price")}
                />
                <Select
                  label="Visibility"
                  data={[
                    { value: "draft", label: "Draft (not visible)" },
                    { value: "published", label: "Published (visible to members)" },
                  ]}
                  value={form.values.status}
                  onChange={(v) => form.setFieldValue("status", (v ?? "draft") as "draft" | "published")}
                />
              </Group>
              <TextInput
                label="Cover image URL"
                placeholder="https://..."
                {...form.getInputProps("coverImageUrl")}
              />
              <TextInput
                label="Nextcloud Talk room token"
                placeholder="Paste the Talk room token for the workshop discussion"
                description="Get this from your Nextcloud Talk room settings"
                {...form.getInputProps("nextcloudTalkToken")}
              />
            </Stack>
          </Paper>

          {/* ── Sessions / Modules ── */}
          <Stack gap="md">
            <Group justify="space-between" align="flex-end">
              <Stack gap={0}>
                <Text size="xs" fw={700} tt="uppercase" lts={1} c="dimmed">Curriculum</Text>
                <Title order={3} style={{ fontFamily: "'Cinzel', serif", color: "#3d1f04" }}>
                  Course Modules
                </Title>
              </Stack>
              <Text size="sm" c="dimmed">{form.values.sessions.length} session{form.values.sessions.length !== 1 ? "s" : ""}</Text>
            </Group>

            {form.values.sessions.length === 0 && (
              <Paper withBorder radius="md" p="xl" style={{ textAlign: "center", borderStyle: "dashed" }}>
                <Text c="dimmed" size="sm">No modules yet. Add your first session below.</Text>
              </Paper>
            )}

            {form.values.sessions.map((session, i) => (
              <SessionPanel
                key={session._key}
                session={session}
                index={i}
                onChange={(updated) => updateSession(session._key, updated)}
                onRemove={() => removeSession(session._key)}
              />
            ))}

            <Button
              variant="default"
              leftSection={<Plus size={16} />}
              onClick={addSession}
              radius="md"
              fullWidth
            >
              Add session
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
