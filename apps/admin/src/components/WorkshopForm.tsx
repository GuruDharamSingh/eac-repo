"use client";

import React, { useState } from 'react';
import {
  Stack,
  TextInput,
  Textarea,
  Button,
  Group,
  Paper,
  Title,
  Text,
  ActionIcon,
  Divider,
  NumberInput,
  Select,
  Card,
  rem,
  Badge,
  Collapse,
  Tooltip,
} from '@mantine/core';
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  Calendar, 
  Clock, 
  MapPin, 
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
  FilePlus
} from 'lucide-react';
import type { Workshop, WorkshopSession, WorkshopResource } from '@elkdonis/types';

interface WorkshopFormProps {
  initialData?: Partial<Workshop>;
  onSave: (data: any) => void;
  loading?: boolean;
}

export function WorkshopForm({ initialData, onSave, loading }: WorkshopFormProps) {
  const [workshop, setWorkshop] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    pitch: initialData?.pitch || '',
    price: initialData?.price || 0,
    sessions: initialData?.sessions || [] as WorkshopSession[],
  });

  const addSession = () => {
    const newSession: any = {
      id: `new_${Date.now()}`,
      title: 'New Session',
      description: '',
      scheduledAt: new Date(),
      durationMinutes: 90,
      isOnline: true,
      orderIndex: workshop.sessions.length,
      resources: [],
    };
    setWorkshop({ ...workshop, sessions: [...workshop.sessions, newSession] });
  };

  const removeSession = (id: string) => {
    setWorkshop({
      ...workshop,
      sessions: workshop.sessions.filter(s => s.id !== id)
    });
  };

  const updateSession = (id: string, updates: Partial<WorkshopSession>) => {
    setWorkshop({
      ...workshop,
      sessions: workshop.sessions.map(s => s.id === id ? { ...s, ...updates } : s)
    });
  };

  const addResource = (sessionId: string) => {
    const newResource: WorkshopResource = {
      id: `res_${Date.now()}`,
      title: 'New Resource',
      type: 'link',
      url: '',
      isPublic: false,
    };
    
    setWorkshop({
      ...workshop,
      sessions: workshop.sessions.map(s => 
        s.id === sessionId 
          ? { ...s, resources: [...(s.resources || []), newResource] } 
          : s
      )
    });
  };

  return (
    <Stack gap="xl">
      <Paper withBorder p="xl" radius="md">
        <Stack gap="md">
          <Title order={3}>General Information</Title>
          <TextInput
            label="Workshop Title"
            placeholder="e.g. The Art of Conscious Gathering"
            value={workshop.title}
            onChange={(e) => setWorkshop({ ...workshop, title: e.currentTarget.value })}
            required
          />
          <Textarea
            label="Short Description"
            placeholder="A brief summary for cards and lists"
            value={workshop.description}
            onChange={(e) => setWorkshop({ ...workshop, description: e.currentTarget.value })}
            rows={2}
          />
          <Textarea
            label="The Pitch (HTML/Markdown)"
            placeholder="The full story, what they'll learn, why join..."
            value={workshop.pitch}
            onChange={(e) => setWorkshop({ ...workshop, pitch: e.currentTarget.value })}
            rows={6}
          />
          <Group grow>
            <NumberInput
              label="Price"
              prefix="$"
              value={workshop.price}
              onChange={(v) => setWorkshop({ ...workshop, price: Number(v) })}
            />
          </Group>
        </Stack>
      </Paper>

      <Stack gap="md">
        <Group justify="space-between">
          <Stack gap={0}>
            <Title order={3}>Curriculum & Sessions</Title>
            <Text size="sm" c="dimmed">Add and manage the sessions for this workshop</Text>
          </Stack>
          <Button leftSection={<Plus size={16} />} onClick={addSession} variant="light">
            Add Session
          </Button>
        </Group>

        {workshop.sessions.length === 0 ? (
          <Paper withBorder p="xl" radius="md" style={{ borderStyle: 'dashed' }}>
            <Stack align="center" gap="xs">
              <Calendar size={32} strokeWidth={1.5} className="text-gray-400" />
              <Text c="dimmed">No sessions added yet. Click "Add Session" to begin.</Text>
            </Stack>
          </Paper>
        ) : (
          <Stack gap="sm">
            {workshop.sessions.map((session, index) => (
              <SessionItem 
                key={session.id}
                session={session}
                index={index}
                onUpdate={(updates) => updateSession(session.id, updates)}
                onRemove={() => removeSession(session.id)}
                onAddResource={() => addResource(session.id)}
              />
            ))}
          </Stack>
        )}
      </Stack>

      <Paper withBorder p="md" radius="md" style={{ position: 'sticky', bottom: rem(20), zIndex: 10 }}>
        <Group justify="flex-end">
          <Button variant="subtle" color="gray">Cancel</Button>
          <Button 
            size="md" 
            px="xl" 
            loading={loading}
            onClick={() => onSave(workshop)}
          >
            Save Workshop
          </Button>
        </Group>
      </Paper>
    </Stack>
  );
}

function SessionItem({ session, index, onUpdate, onRemove, onAddResource }: any) {
  const [opened, setOpened] = useState(true);

  return (
    <Card withBorder radius="md" p={0}>
      <Group p="md" justify="space-between" wrap="nowrap" style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
        <Group gap="sm" wrap="nowrap">
          <GripVertical size={18} className="text-gray-400 cursor-grab" />
          <Badge variant="filled" color="indigo" size="sm">Session {index + 1}</Badge>
          <Text fw={600}>{session.title || 'Untitled Session'}</Text>
        </Group>
        <Group gap="xs">
          <ActionIcon variant="subtle" color="gray" onClick={() => setOpened(!opened)}>
            {opened ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </ActionIcon>
          <ActionIcon variant="subtle" color="red" onClick={onRemove}>
            <Trash2 size={16} />
          </ActionIcon>
        </Group>
      </Group>

      <Collapse in={opened}>
        <Stack p="md" gap="md">
          <TextInput
            label="Session Title"
            value={session.title}
            onChange={(e) => onUpdate({ title: e.currentTarget.value })}
          />
          <Textarea
            label="Session Description"
            value={session.description}
            onChange={(e) => onUpdate({ description: e.currentTarget.value })}
            rows={2}
          />
          <Group grow>
            <TextInput
              label="Date & Time"
              placeholder="2026-05-01 18:00"
              value={session.scheduledAt instanceof Date ? session.scheduledAt.toISOString().slice(0, 16) : session.scheduledAt}
              onChange={(e) => onUpdate({ scheduledAt: e.currentTarget.value })}
              leftSection={<Calendar size={14} />}
            />
            <NumberInput
              label="Duration (mins)"
              value={session.durationMinutes}
              onChange={(v) => onUpdate({ durationMinutes: Number(v) })}
              leftSection={<Clock size={14} />}
            />
          </Group>

          <Divider label="Resources" labelPosition="left" variant="dotted" />
          
          <Stack gap="xs">
            {session.resources?.map((res: any, rIndex: number) => (
              <Group key={res.id} wrap="nowrap" align="flex-end">
                <TextInput
                  label={rIndex === 0 ? "Resource Title" : undefined}
                  style={{ flex: 2 }}
                  value={res.title}
                  onChange={(e) => {
                    const newResources = [...session.resources];
                    newResources[rIndex].title = e.currentTarget.value;
                    onUpdate({ resources: newResources });
                  }}
                />
                <Select
                  label={rIndex === 0 ? "Type" : undefined}
                  style={{ flex: 1 }}
                  data={['link', 'pdf', 'video', 'other']}
                  value={res.type}
                  onChange={(v) => {
                    const newResources = [...session.resources];
                    newResources[rIndex].type = v as any;
                    onUpdate({ resources: newResources });
                  }}
                />
                <TextInput
                  label={rIndex === 0 ? "URL" : undefined}
                  style={{ flex: 3 }}
                  value={res.url}
                  onChange={(e) => {
                    const newResources = [...session.resources];
                    newResources[rIndex].url = e.currentTarget.value;
                    onUpdate({ resources: newResources });
                  }}
                />
                <ActionIcon 
                  color="red" 
                  variant="subtle" 
                  mb={4}
                  onClick={() => {
                    onUpdate({ resources: session.resources.filter((_: any, i: number) => i !== rIndex) });
                  }}
                >
                  <Trash2 size={14} />
                </ActionIcon>
              </Group>
            ))}
            <Button 
              variant="subtle" 
              size="xs" 
              leftSection={<FilePlus size={14} />}
              onClick={onAddResource}
              alignSelf="flex-start"
            >
              Add Resource
            </Button>
          </Stack>
        </Stack>
      </Collapse>
    </Card>
  );
}
