/**
 * Poll Creator Component
 * Simple form to create availability polls
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ActionIcon,
  Button,
  Checkbox,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { Calendar as CalendarIcon, Plus, X } from 'lucide-react';
import { format } from 'date-fns';

interface TimeSlot {
  id: string;
  date: Date;
}

export function PollCreator() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [allowMaybe, setAllowMaybe] = useState(true);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [newSlotTime, setNewSlotTime] = useState('09:00');
  const [submitting, setSubmitting] = useState(false);

  const handleAddTimeSlot = () => {
    if (selectedDates.length === 0) {
      alert('Please select at least one date first');
      return;
    }

    const [hours, minutes] = newSlotTime.split(':').map(Number);

    // Add time slot for each selected date
    const newSlots: TimeSlot[] = selectedDates.map((date) => {
      const slotDate = new Date(date);
      slotDate.setHours(hours, minutes, 0, 0);
      return {
        id: `${slotDate.getTime()}`,
        date: slotDate,
      };
    });

    setTimeSlots([...timeSlots, ...newSlots]);
  };

  const handleRemoveSlot = (id: string) => {
    setTimeSlots(timeSlots.filter((slot) => slot.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('Please enter a poll title');
      return;
    }

    if (timeSlots.length === 0) {
      alert('Please add at least one time slot');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          timeSlots: timeSlots.map((slot) => slot.date.toISOString()),
          allowMaybe,
          slotDuration: 30, // Default 30 minutes
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create poll');
      }

      const data = await response.json();
      router.push(`/polls/${data.poll.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create poll');
      setSubmitting(false);
    }
  };

  // Sort time slots chronologically
  const sortedSlots = [...timeSlots].sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg">
        {/* Basic Info */}
        <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
          <Paper bg="indigo.0" p="md">
            <Title order={4}>Poll Details</Title>
            <Text size="sm" c="dimmed">Give your poll a name and description</Text>
          </Paper>
          <Stack gap="md" p="md">
            <TextInput
              label="Title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Weekly Team Meeting"
            />
            <Textarea
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any additional details about this meeting..."
              rows={3}
            />
          </Stack>
        </Paper>

        {/* Date Selection */}
        <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
          <Paper bg="blue.0" p="md">
            <Title order={4}>Select Dates</Title>
            <Text size="sm" c="dimmed">
              Choose the dates you want to include (click multiple dates)
            </Text>
          </Paper>
          <Stack gap="md" p="md">
            <DatePicker
              type="multiple"
              value={selectedDates}
              onChange={(dates) => setSelectedDates(dates || [])}
            />
            {selectedDates.length > 0 && (
              <Text size="sm" c="dimmed">
                {selectedDates.length} {selectedDates.length === 1 ? 'date' : 'dates'} selected
              </Text>
            )}
          </Stack>
        </Paper>

        {/* Time Slot Builder */}
        <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
          <Paper bg="green.0" p="md">
            <Title order={4}>Add Time Slots</Title>
            <Text size="sm" c="dimmed">
              Add times for each selected date (e.g., 9:00 AM)
            </Text>
          </Paper>
          <Stack gap="md" p="md">
            <Group>
              <TextInput
                type="time"
                value={newSlotTime}
                onChange={(e) => setNewSlotTime(e.target.value)}
                disabled={selectedDates.length === 0}
                style={{ flex: 1 }}
              />
              <Button
                type="button"
                onClick={handleAddTimeSlot}
                disabled={selectedDates.length === 0}
                leftSection={<Plus size={16} />}
              >
                Add Time
              </Button>
            </Group>

            {sortedSlots.length > 0 && (
              <Stack gap="xs" mah={256} style={{ overflowY: 'auto' }}>
                <Text size="sm" fw={500}>
                  {sortedSlots.length} time {sortedSlots.length === 1 ? 'slot' : 'slots'}:
                </Text>
                {sortedSlots.map((slot) => (
                  <Paper key={slot.id} withBorder radius="md" p="sm">
                    <Group justify="space-between">
                      <Group gap="xs">
                        <CalendarIcon size={16} color="var(--mantine-color-gray-6)" />
                        <Text size="sm">
                          {format(slot.date, 'EEE, MMM d, yyyy • h:mm a')}
                        </Text>
                      </Group>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={() => handleRemoveSlot(slot.id)}
                      >
                        <X size={16} />
                      </ActionIcon>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}
          </Stack>
        </Paper>

        {/* Settings */}
        <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
          <Paper bg="orange.0" p="md">
            <Title order={4}>Poll Settings</Title>
          </Paper>
          <Stack gap="md" p="md">
            <Checkbox
              label='Allow "Maybe" responses'
              checked={allowMaybe}
              onChange={(e) => setAllowMaybe(e.currentTarget.checked)}
            />
          </Stack>
        </Paper>

        {/* Submit */}
        <Paper withBorder radius="lg" p="md" bg="indigo.0">
          <Group>
            <Button
              type="submit"
              size="md"
              disabled={submitting || !title.trim() || timeSlots.length === 0}
              style={{ flex: 1 }}
            >
              {submitting ? 'Creating Poll...' : `Create Poll (${timeSlots.length} slots)`}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => router.back()}
              disabled={submitting}
            >
              Cancel
            </Button>
          </Group>
          {timeSlots.length === 0 && (
            <Text size="xs" c="dimmed" ta="center" mt="sm">
              Add at least one time slot to create the poll
            </Text>
          )}
        </Paper>
      </Stack>
    </form>
  );
}
