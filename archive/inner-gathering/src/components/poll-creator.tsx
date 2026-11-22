/**
 * Poll Creator Component
 * Supports both Quick Polls (question + options) and Availability Polls (time slots)
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
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { DatePicker, DateTimePicker } from '@mantine/dates';
import {
  BarChart3,
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { format } from 'date-fns';

type PollMode = 'quick' | 'availability';

interface TimeSlot {
  id: string;
  date: Date;
}

export function PollCreator() {
  const router = useRouter();
  const [pollMode, setPollMode] = useState<PollMode>('quick');
  const [submitting, setSubmitting] = useState(false);

  // Shared fields
  const [description, setDescription] = useState('');

  // ─── Quick Poll fields ───
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [pollType, setPollType] = useState<'single_choice' | 'multi_choice'>('single_choice');
  const [deadline, setDeadline] = useState<Date | null>(null);

  // ─── Availability Poll fields ───
  const [title, setTitle] = useState('');
  const [allowMaybe, setAllowMaybe] = useState(true);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [newSlotTime, setNewSlotTime] = useState('09:00');

  // ─── Quick Poll handlers ───
  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    setOptions(options.map((o, i) => (i === index ? value : o)));
  };

  const isQuickPollValid =
    question.trim().length > 0 &&
    options.filter((o) => o.trim().length > 0).length >= 2;

  const handleQuickPollSubmit = async () => {
    setSubmitting(true);
    try {
      const response = await fetch('/api/question-polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          description: description.trim() || undefined,
          options: options.filter((o) => o.trim().length > 0),
          pollType,
          deadline: deadline?.toISOString() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create poll');
      }

      router.push('/polls');
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create poll');
      setSubmitting(false);
    }
  };

  // ─── Availability Poll handlers ───
  const handleAddTimeSlot = () => {
    if (selectedDates.length === 0) {
      alert('Please select at least one date first');
      return;
    }

    const [hours, minutes] = newSlotTime.split(':').map(Number);

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

  const handleAvailabilitySubmit = async () => {
    setSubmitting(true);
    try {
      const dates = timeSlots.map((s) => s.date);
      const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
      const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

      const times = dates.map((d) => d.getHours() * 60 + d.getMinutes());
      const minMinutes = Math.min(...times);
      const maxMinutes = Math.max(...times);
      const earliestTime = `${String(Math.floor(minMinutes / 60)).padStart(2, '0')}:${String(minMinutes % 60).padStart(2, '0')}`;
      const latestTime = `${String(Math.floor(maxMinutes / 60)).padStart(2, '0')}:${String(maxMinutes % 60).padStart(2, '0')}`;

      const response = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          startDate: minDate.toISOString().split('T')[0],
          endDate: maxDate.toISOString().split('T')[0],
          earliestTime,
          latestTime,
          timeSlotDuration: 30,
          allowMaybe,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pollMode === 'quick') {
      await handleQuickPollSubmit();
    } else {
      await handleAvailabilitySubmit();
    }
  };

  const sortedSlots = [...timeSlots].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  return (
    <form onSubmit={handleSubmit} className="archive-work-surface">
      <Stack gap="lg">
        {/* Poll Type Selector */}
        <SegmentedControl
          value={pollMode}
          onChange={(val) => setPollMode(val as PollMode)}
          data={[
            {
              value: 'quick',
              label: (
                <Group gap={6} justify="center" wrap="nowrap">
                  <BarChart3 size={14} />
                  <Text size="sm">Quick Poll</Text>
                </Group>
              ),
            },
            {
              value: 'availability',
              label: (
                <Group gap={6} justify="center" wrap="nowrap">
                  <CalendarIcon size={14} />
                  <Text size="sm">Availability Poll</Text>
                </Group>
              ),
            },
          ]}
          color="archive"
          fullWidth
        />

        {/* ═══════════════════════════════════════════════════ */}
        {/* QUICK POLL MODE                                     */}
        {/* ═══════════════════════════════════════════════════ */}
        {pollMode === 'quick' && (
          <>
            {/* Question */}
            <Paper withBorder radius="sm" p="md" className="archive-card">
              <div className="archive-page-header">
                <Title order={4}>Your Question</Title>
                <Text size="sm" className="archive-muted">
                  What do you want to ask the community?
                </Text>
              </div>
              <Stack gap="md" pt="md">
                <TextInput
                  label="Question"
                  required
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g., What topic should we cover next week?"
                  size="md"
                />
                <Textarea
                  label="Description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add context or details..."
                  rows={2}
                />
              </Stack>
            </Paper>

            {/* Options */}
            <Paper withBorder radius="sm" p="md" className="archive-card">
              <div className="archive-page-header">
                <Group justify="space-between">
                  <div>
                    <Title order={4}>Answer Options</Title>
                    <Text size="sm" className="archive-muted">
                      Add 2-10 options for people to choose from
                    </Text>
                  </div>
                  <Button
                    type="button"
                    size="xs"
                    variant="light"
                    color="archive"
                    leftSection={<Plus size={14} />}
                    onClick={handleAddOption}
                    disabled={options.length >= 10}
                  >
                    Add
                  </Button>
                </Group>
              </div>
              <Stack gap="xs" pt="md">
                {options.map((option, index) => (
                  <Group key={index} gap="xs">
                    <TextInput
                      value={option}
                      onChange={(e) =>
                        handleOptionChange(index, e.target.value)
                      }
                      placeholder={`Option ${index + 1}`}
                      style={{ flex: 1 }}
                    />
                    {options.length > 2 && (
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleRemoveOption(index)}
                      >
                        <Trash2 size={16} />
                      </ActionIcon>
                    )}
                  </Group>
                ))}
              </Stack>
            </Paper>

            {/* Settings */}
            <Paper withBorder radius="sm" p="md" className="archive-card">
              <div className="archive-page-header">
                <Title order={4}>Settings</Title>
              </div>
              <Stack gap="md" pt="md">
                <Select
                  label="Poll type"
                  data={[
                    { value: 'single_choice', label: 'Single choice (pick one)' },
                    { value: 'multi_choice', label: 'Multiple choice (pick many)' },
                  ]}
                  value={pollType}
                  onChange={(val) =>
                    setPollType(
                      (val as 'single_choice' | 'multi_choice') ||
                        'single_choice'
                    )
                  }
                />
                <DateTimePicker
                  label="Deadline (optional)"
                  placeholder="No deadline"
                  value={deadline}
                  onChange={(val) => setDeadline(val ? new Date(val) : null)}
                  clearable
                />
              </Stack>
            </Paper>

            {/* Submit */}
            <Paper withBorder radius="sm" p="md" className="archive-card">
              <Group>
                <Button
                  type="submit"
                  size="md"
                  color="archive"
                  disabled={submitting || !isQuickPollValid}
                  style={{ flex: 1 }}
                >
                  {submitting
                    ? 'Creating Poll...'
                    : `Create Poll (${options.filter((o) => o.trim()).length} options)`}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  color="archive"
                  onClick={() => router.back()}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </Group>
            </Paper>
          </>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* AVAILABILITY POLL MODE                              */}
        {/* ═══════════════════════════════════════════════════ */}
        {pollMode === 'availability' && (
          <>
            {/* Basic Info */}
            <Paper withBorder radius="sm" p="md" className="archive-card">
              <div className="archive-page-header">
                <Title order={4}>Poll Details</Title>
                <Text size="sm" className="archive-muted">
                  Give your poll a name and description
                </Text>
              </div>
              <Stack gap="md" pt="md">
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
            <Paper withBorder radius="sm" p="md" className="archive-card">
              <div className="archive-page-header">
                <Title order={4}>Select Dates</Title>
                <Text size="sm" className="archive-muted">
                  Choose the dates you want to include (click multiple dates)
                </Text>
              </div>
              <Stack gap="md" pt="md">
                <DatePicker
                  type="multiple"
                  value={selectedDates}
                  onChange={(dates) => setSelectedDates(dates || [])}
                />
                {selectedDates.length > 0 && (
                  <Text size="sm" c="dimmed">
                    {selectedDates.length}{' '}
                    {selectedDates.length === 1 ? 'date' : 'dates'} selected
                  </Text>
                )}
              </Stack>
            </Paper>

            {/* Time Slot Builder */}
            <Paper withBorder radius="sm" p="md" className="archive-card">
              <div className="archive-page-header">
                <Title order={4}>Add Time Slots</Title>
                <Text size="sm" className="archive-muted">
                  Add times for each selected date (e.g., 9:00 AM)
                </Text>
              </div>
              <Stack gap="md" pt="md">
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
                    color="archive"
                    leftSection={<Plus size={16} />}
                  >
                    Add Time
                  </Button>
                </Group>

                {sortedSlots.length > 0 && (
                  <Stack gap="xs" mah={256} style={{ overflowY: 'auto' }}>
                    <Text size="sm" fw={500}>
                      {sortedSlots.length} time{' '}
                      {sortedSlots.length === 1 ? 'slot' : 'slots'}:
                    </Text>
                    {sortedSlots.map((slot) => (
                      <Paper key={slot.id} withBorder radius="sm" p="sm" className="archive-tile">
                        <Group justify="space-between">
                          <Group gap="xs">
                            <CalendarIcon
                              size={16}
                              color="var(--mantine-color-gray-6)"
                            />
                            <Text size="sm">
                              {format(slot.date, 'EEE, MMM d, yyyy \u2022 h:mm a')}
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
            <Paper withBorder radius="sm" p="md" className="archive-card">
              <div className="archive-page-header">
                <Title order={4}>Poll Settings</Title>
              </div>
              <Stack gap="md" pt="md">
                <Checkbox
                  label='Allow "Maybe" responses'
                  checked={allowMaybe}
                  onChange={(e) => setAllowMaybe(e.currentTarget.checked)}
                />
              </Stack>
            </Paper>

            {/* Submit */}
            <Paper withBorder radius="sm" p="md" className="archive-card">
              <Group>
                <Button
                  type="submit"
                  size="md"
                  color="archive"
                  disabled={
                    submitting || !title.trim() || timeSlots.length === 0
                  }
                  style={{ flex: 1 }}
                >
                  {submitting
                    ? 'Creating Poll...'
                    : `Create Poll (${timeSlots.length} slots)`}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  color="archive"
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
          </>
        )}
      </Stack>
    </form>
  );
}
