'use client';

import { useState } from 'react';
import { TextInput, Textarea, Button, Stack, Alert, Group, Text } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { IconCheck } from '@tabler/icons-react';
import '@mantine/dates/styles.css';

export function CreateMeetingForm() {
  const [title, setTitle] = useState('Amrit Vela Sadhana');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledAt) {
      setError('Please select a date and time.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, location, description, scheduled_at: scheduledAt.toISOString() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to create session');
      }
      setSuccess(true);
      setLocation('');
      setDescription('');
      setScheduledAt(null);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        {success && (
          <Alert icon={<IconCheck size={16} />} color="yellow" variant="light"
            style={{ background: 'rgba(244,196,48,0.15)', border: '1px solid rgba(244,196,48,0.4)', color: '#36454f' }}
          >
            Session scheduled successfully!
          </Alert>
        )}
        {error && (
          <Alert color="red" variant="light">{error}</Alert>
        )}

        <TextInput
          required
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          size="md"
        />

        <DateTimePicker
          required
          label="Date & Time"
          placeholder="Select date and time"
          value={scheduledAt}
          onChange={setScheduledAt}
          size="md"
          clearable
        />

        <TextInput
          label="Location"
          placeholder="e.g. St. George's Church, Etobicoke"
          value={location}
          onChange={(e) => setLocation(e.currentTarget.value)}
          size="md"
        />

        <Textarea
          label="Description (optional)"
          placeholder="Any special notes for this gathering..."
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          rows={3}
        />

        <Group justify="flex-end">
          <Button
            type="submit"
            loading={loading}
            style={{
              background: 'linear-gradient(90deg, #f4c430, #e67e50)',
              color: '#36454f',
              fontWeight: 700,
              border: 'none',
            }}
          >
            Schedule Session
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
