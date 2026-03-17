'use client';

import { useState } from 'react';
import { Button, Text, Stack, Alert } from '@mantine/core';
import { IconCheck, IconLogin } from '@tabler/icons-react';
import Link from 'next/link';

interface RsvpButtonProps {
  meetingId: string;
  isLoggedIn: boolean;
}

export function RsvpButton({ meetingId, isLoggedIn }: RsvpButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'attending' | 'error'>('idle');

  if (!isLoggedIn) {
    return (
      <Stack gap="xs">
        <Text size="sm" c="dimmed" ta="center">
          Sign in to RSVP and receive a reminder before the sadhana.
        </Text>
        <Button
          component={Link}
          href="/login"
          leftSection={<IconLogin size={16} />}
          variant="outline"
          style={{ borderColor: '#f4c430', color: '#8d6708' }}
        >
          Sign in to RSVP
        </Button>
      </Stack>
    );
  }

  if (status === 'attending') {
    return (
      <Alert
        icon={<IconCheck size={18} />}
        color="yellow"
        style={{ background: 'rgba(244,196,48,0.12)', border: '1px solid rgba(244,196,48,0.4)', color: '#36454f' }}
      >
        You are attending this sadhana. Waheguru!
      </Alert>
    );
  }

  const handleRsvp = async () => {
    setStatus('loading');
    try {
      const res = await fetch(`/api/meetings/${meetingId}/rsvp`, { method: 'POST' });
      if (res.ok) {
        setStatus('attending');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <Stack gap="xs">
      {status === 'error' && (
        <Text size="sm" c="red">
          Something went wrong. Please try again.
        </Text>
      )}
      <Button
        onClick={handleRsvp}
        loading={status === 'loading'}
        size="md"
        style={{
          background: 'linear-gradient(90deg, #f4c430, #e67e50)',
          color: '#36454f',
          fontWeight: 700,
          border: 'none',
        }}
      >
        RSVP — I'm Attending
      </Button>
      <Text size="xs" c="dimmed" ta="center">
        You'll receive a reminder before the sadhana
      </Text>
    </Stack>
  );
}
