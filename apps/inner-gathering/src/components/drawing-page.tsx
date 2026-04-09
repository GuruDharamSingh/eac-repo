"use client";

import { useCallback, useRef } from "react";
import { Button, Container, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { ArrowLeft } from "lucide-react";
import { ExcalidrawEditor } from "@elkdonis/ui";
import Link from "next/link";
import type { Meeting, EventPage } from "@elkdonis/types";

interface DrawingPageProps {
  meeting: Meeting;
  eventPage: EventPage;
}

export function DrawingPage({ meeting, eventPage }: DrawingPageProps) {
  // Auto-save drawing changes (debounced)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleDrawingChange = useCallback(
    (data: Record<string, unknown>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await fetch(`/api/meetings/${meeting.id}/event-page`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ drawing: data }),
          });
        } catch (err) {
          console.error('Failed to auto-save drawing:', err);
        }
      }, 2000);
    },
    [meeting.id]
  );

  return (
    <Container size="xl" py="md">
      <Stack gap="md">
        {/* Header */}
        <Paper withBorder radius="md" p="md">
          <Group justify="space-between">
            <Stack gap="xs">
              <Title order={2}>{meeting.title}</Title>
              <Text size="sm" c="dimmed">Collaborative Drawing Canvas</Text>
            </Stack>
            <Button
              component={Link}
              href={`/meetings/${meeting.id}`}
              variant="light"
              leftSection={<ArrowLeft size={16} />}
            >
              Back to Event
            </Button>
          </Group>
        </Paper>

        {/* Drawing Canvas */}
        <Paper withBorder radius="md" p="md" style={{ minHeight: '600px' }}>
          <ExcalidrawEditor
            initialData={eventPage.drawing}
            onChange={handleDrawingChange}
            label=""
            height={600}
          />
        </Paper>

        <Text size="xs" c="dimmed" ta="center">
          Changes are automatically saved every 2 seconds
        </Text>
      </Stack>
    </Container>
  );
}
