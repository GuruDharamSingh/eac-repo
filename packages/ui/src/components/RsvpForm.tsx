'use client';

import { useState } from 'react';
import {
  Stack,
  TextInput,
  Textarea,
  Checkbox,
  Button,
  Text,
  Alert,
  Anchor,
} from '@mantine/core';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

export interface RsvpFormProps {
  meetingId: string;
  meetingTitle: string;
  apiPath?: string;
}

type FormState = 'idle' | 'submitting' | 'success' | 'error';

export function RsvpForm({ meetingId, meetingTitle, apiPath = '/api/rsvp' }: RsvpFormProps) {
  const [state, setState] = useState<FormState>('idle');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
    wants_reminder: false,
  });

  if (state === 'success') {
    return (
      <Alert
        icon={<IconCheck size={18} />}
        color="green"
        radius="md"
        style={{ background: 'rgba(40, 167, 69, 0.08)', border: '1px solid rgba(40, 167, 69, 0.3)' }}
      >
        <Text fw={600} size="sm" mb={4}>You're on the list — Waheguru!</Text>
        <Text size="sm" c="dimmed">
          Want to stay connected?{' '}
          <Anchor href="https://eac.elkdonis-arts.org" target="_blank" rel="noopener noreferrer" size="sm">
            Join the Amrit Canada community
          </Anchor>
          {' '}at Elkdonis Arts Collective.
        </Text>
      </Alert>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Your name is required.');
      return;
    }
    setState('submitting');
    setError('');
    try {
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_id: meetingId, ...form }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Something went wrong');
      }
      setState('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setState('error');
    }
  };

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = e.currentTarget.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="sm">
        <Text size="sm" fw={600} style={{ color: 'var(--charcoal, #36454f)' }}>
          RSVP for {meetingTitle}
        </Text>

        {state === 'error' && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" radius="md">
            {error}
          </Alert>
        )}

        <TextInput
          label="Your name"
          placeholder="Sat Nam"
          required
          value={form.name}
          onChange={set('name')}
          styles={{ input: { backgroundColor: '#fff', color: '#36454f' } }}
        />
        <TextInput
          label="Email (optional)"
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={set('email')}
          styles={{ input: { backgroundColor: '#fff', color: '#36454f' } }}
        />
        <TextInput
          label="Phone (optional)"
          placeholder="+1 (416) 555-0100"
          value={form.phone}
          onChange={set('phone')}
          styles={{ input: { backgroundColor: '#fff', color: '#36454f' } }}
        />
        <Textarea
          label="Question for the teacher (optional)"
          placeholder="Any questions or notes…"
          rows={3}
          value={form.message}
          onChange={set('message')}
          styles={{ input: { backgroundColor: '#fff', color: '#36454f' } }}
        />
        <Checkbox
          label="Remind me before the session (email required)"
          checked={form.wants_reminder}
          onChange={(e) => setForm((f) => ({ ...f, wants_reminder: e.currentTarget.checked }))}
          disabled={!form.email}
        />

        <Button
          type="submit"
          loading={state === 'submitting'}
          size="md"
          style={{
            background: 'linear-gradient(90deg, var(--saffron-bright, #f4c430), var(--terracotta-bright, #e67e50))',
            color: '#36454f',
            fontWeight: 700,
            border: 'none',
          }}
        >
          RSVP — I'm Attending
        </Button>
      </Stack>
    </form>
  );
}
