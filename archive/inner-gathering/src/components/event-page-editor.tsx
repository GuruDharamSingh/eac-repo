"use client";

import { useState } from "react";
import {
  ActionIcon,
  Button,
  ColorInput,
  Container,
  Group,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Plus, Trash2, ArrowLeft, Save, PenTool } from "lucide-react";
import type { Meeting, EventPage, EventPageColors, EventPageLayout, EventPageTableData } from "@elkdonis/types";
import { RichTextEditor } from "@elkdonis/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface EventPageEditorProps {
  meeting: Meeting;
  eventPage: EventPage | null;
}

const LAYOUT_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "image-right-text-left", label: "Image Right, Text Left" },
  { value: "image-left-text-right", label: "Image Left, Text Right" },
  { value: "full-width-hero", label: "Full-Width Hero" },
];

export function EventPageEditor({ meeting, eventPage }: EventPageEditorProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Content state
  const initialHtml =
    eventPage?.content && typeof eventPage.content === "object"
      ? (eventPage.content as { html?: string }).html || ""
      : "";
  const [htmlContent, setHtmlContent] = useState(initialHtml);

  // Layout state
  const [layout, setLayout] = useState<EventPageLayout>(
    eventPage?.layout || "default"
  );

  // Colors state
  const [colors, setColors] = useState<EventPageColors>(
    eventPage?.colors || {}
  );

  // Table data state
  const [tableData, setTableData] = useState<EventPageTableData>({
    columns: Array.isArray(eventPage?.tableData?.columns) ? eventPage.tableData.columns : [],
    rows: Array.isArray(eventPage?.tableData?.rows) ? eventPage.tableData.rows : [],
  });

  // Published state
  const [isPublished, setIsPublished] = useState(
    eventPage?.isPublished ?? false
  );

  // Drawing state
  const [hasDrawing, setHasDrawing] = useState(
    eventPage?.drawing != null
  );

  const handleCreateEventPage = async () => {
    setIsCreating(true);
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/event-page`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to create event page");
      }
      router.refresh();
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to create event page",
        color: "red",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/event-page`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { html: htmlContent },
          colors,
          tableData,
          layout,
          drawing: hasDrawing ? (eventPage?.drawing || { elements: [], appState: {} }) : null,
          isPublished,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save event page");
      }

      notifications.show({
        title: "Saved",
        message: "Event page updated successfully",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to save event page",
        color: "red",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Table helpers
  const addColumn = () => {
    setTableData((prev) => ({
      columns: [...prev.columns, `Column ${prev.columns.length + 1}`],
      rows: prev.rows.map((row) => [...row, ""]),
    }));
  };

  const removeColumn = (index: number) => {
    setTableData((prev) => ({
      columns: prev.columns.filter((_, i) => i !== index),
      rows: prev.rows.map((row) => row.filter((_, i) => i !== index)),
    }));
  };

  const addRow = () => {
    setTableData((prev) => ({
      ...prev,
      rows: [...prev.rows, prev.columns.map(() => "")],
    }));
  };

  const removeRow = (index: number) => {
    setTableData((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, i) => i !== index),
    }));
  };

  const updateColumnName = (index: number, value: string) => {
    setTableData((prev) => ({
      ...prev,
      columns: prev.columns.map((col, i) => (i === index ? value : col)),
    }));
  };

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    setTableData((prev) => ({
      ...prev,
      rows: prev.rows.map((row, ri) =>
        ri === rowIndex
          ? row.map((cell, ci) => (ci === colIndex ? value : cell))
          : row
      ),
    }));
  };

  // No event page yet - show create button
  if (!eventPage) {
    return (
      <Container size="sm" py="xl">
        <Stack gap="lg" align="center">
          <Title order={2}>Event Page for: {meeting.title}</Title>
          <Text c="dimmed">
            No event page exists yet for this meeting. Create one to add rich
            content, custom colors, and data tables.
          </Text>
          <Button
            size="lg"
            onClick={handleCreateEventPage}
            loading={isCreating}
          >
            Create Event Page
          </Button>
          <Button
            component={Link}
            href={`/meetings/${meeting.id}`}
            variant="subtle"
            leftSection={<ArrowLeft size={16} />}
          >
            Back to Meeting
          </Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between">
          <Stack gap={4}>
            <Title order={2}>Edit Event Page</Title>
            <Text c="dimmed">{meeting.title}</Text>
          </Stack>
          <Group>
            <Button
              component={Link}
              href={`/meetings/${meeting.id}`}
              variant="subtle"
              leftSection={<ArrowLeft size={16} />}
            >
              View Page
            </Button>
            <Button
              onClick={handleSave}
              loading={isSaving}
              leftSection={<Save size={16} />}
            >
              Save
            </Button>
          </Group>
        </Group>

        {/* Publish Toggle */}
        <Paper withBorder radius="md" p="md">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text fw={600}>Published</Text>
              <Text size="sm" c="dimmed">
                When published, the event page will be visible to everyone and
                linked from the meeting card.
              </Text>
            </Stack>
            <Switch
              checked={isPublished}
              onChange={(e) => setIsPublished(e.currentTarget.checked)}
              size="lg"
            />
          </Group>
        </Paper>

        {/* Layout Selection */}
        <Paper withBorder radius="md" p="lg">
          <Stack gap="md">
            <Title order={4}>Layout</Title>
            <Select
              label="Page Layout"
              data={LAYOUT_OPTIONS}
              value={layout}
              onChange={(value) =>
                setLayout((value as EventPageLayout) || "default")
              }
            />
          </Stack>
        </Paper>

        {/* Color Theming */}
        <Paper withBorder radius="md" p="lg">
          <Stack gap="md">
            <Title order={4}>Colors</Title>
            <Group grow>
              <ColorInput
                label="Background"
                placeholder="Default"
                value={colors.background || ""}
                onChange={(value) =>
                  setColors((prev) => ({ ...prev, background: value || undefined }))
                }
              />
              <ColorInput
                label="Accent"
                placeholder="Default"
                value={colors.accent || ""}
                onChange={(value) =>
                  setColors((prev) => ({ ...prev, accent: value || undefined }))
                }
              />
              <ColorInput
                label="Text"
                placeholder="Default"
                value={colors.text || ""}
                onChange={(value) =>
                  setColors((prev) => ({ ...prev, text: value || undefined }))
                }
              />
            </Group>
          </Stack>
        </Paper>

        {/* Rich Text Editor */}
        <Paper withBorder radius="md" p="lg">
          <Stack gap="md">
            <Title order={4}>Content</Title>
            <RichTextEditor content={htmlContent} onChange={setHtmlContent} />
          </Stack>
        </Paper>

        {/* Data Table Editor */}
        <Paper withBorder radius="md" p="lg">
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={4}>Data Table</Title>
              <Group>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<Plus size={14} />}
                  onClick={addColumn}
                >
                  Add Column
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<Plus size={14} />}
                  onClick={addRow}
                  disabled={tableData.columns.length === 0}
                >
                  Add Row
                </Button>
              </Group>
            </Group>

            {tableData.columns.length > 0 ? (
              <Table withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    {tableData.columns.map((col, ci) => (
                      <Table.Th key={ci}>
                        <Group gap="xs" wrap="nowrap">
                          <TextInput
                            size="xs"
                            value={col}
                            onChange={(e) =>
                              updateColumnName(ci, e.currentTarget.value)
                            }
                            style={{ flex: 1 }}
                            variant="unstyled"
                            fw={600}
                          />
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            color="red"
                            onClick={() => removeColumn(ci)}
                          >
                            <Trash2 size={12} />
                          </ActionIcon>
                        </Group>
                      </Table.Th>
                    ))}
                    <Table.Th w={40} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {tableData.rows.map((row, ri) => (
                    <Table.Tr key={ri}>
                      {row.map((cell, ci) => (
                        <Table.Td key={ci}>
                          <TextInput
                            size="xs"
                            value={cell}
                            onChange={(e) =>
                              updateCell(ri, ci, e.currentTarget.value)
                            }
                            variant="unstyled"
                          />
                        </Table.Td>
                      ))}
                      <Table.Td>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          color="red"
                          onClick={() => removeRow(ri)}
                        >
                          <Trash2 size={12} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text size="sm" c="dimmed" ta="center" py="md">
                No table data yet. Click "Add Column" to start building a table.
              </Text>
            )}
          </Stack>
        </Paper>

        {/* Drawing Canvas */}
        <Paper withBorder radius="md" p="lg">
          <Stack gap="md">
            <Group justify="space-between">
              <Group gap="xs">
                <PenTool size={16} />
                <Title order={4}>Drawing Canvas</Title>
              </Group>
            </Group>
            {!hasDrawing ? (
              <Stack gap="sm" align="center" py="xl">
                <Text size="sm" c="dimmed" ta="center">
                  Add a collaborative drawing canvas where visitors can draw, sketch, and annotate together.
                </Text>
                <Button
                  variant="light"
                  leftSection={<PenTool size={16} />}
                  onClick={() => setHasDrawing(true)}
                >
                  Add Drawing Canvas
                </Button>
              </Stack>
            ) : (
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Drawing canvas is enabled. Visitors can view and edit on the event page.
                  </Text>
                  <Button
                    variant="subtle"
                    color="red"
                    size="xs"
                    onClick={() => setHasDrawing(false)}
                  >
                    Remove
                  </Button>
                </Group>
              </Stack>
            )}
          </Stack>
        </Paper>

        {/* Bottom Save Button */}
        <Group justify="flex-end">
          <Button
            onClick={handleSave}
            loading={isSaving}
            leftSection={<Save size={16} />}
            size="lg"
          >
            Save Event Page
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
