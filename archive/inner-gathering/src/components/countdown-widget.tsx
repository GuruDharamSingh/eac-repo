'use client';

import { useState, useEffect } from 'react';
import { Card, Stack, Text, Title, Box } from '@mantine/core';
import { Clock } from 'lucide-react';

interface CountdownWidgetProps {
  meeting: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    location?: string;
    description?: string;
  };
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function calculateTimeRemaining(targetTime: string): TimeRemaining {
  const total = new Date(targetTime).getTime() - new Date().getTime();

  if (total <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  }

  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));

  return { days, hours, minutes, seconds, total };
}

export function CountdownWidget({ meeting }: CountdownWidgetProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>(
    calculateTimeRemaining(meeting.startTime)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining(meeting.startTime));
    }, 1000);

    return () => clearInterval(interval);
  }, [meeting.startTime]);

  const formatCountdown = () => {
    if (timeRemaining.total <= 0) {
      return 'Starting soon...';
    }

    const parts = [];
    if (timeRemaining.days > 0) parts.push(`${timeRemaining.days}d`);
    if (timeRemaining.hours > 0) parts.push(`${timeRemaining.hours}h`);
    if (timeRemaining.minutes > 0) parts.push(`${timeRemaining.minutes}m`);
    parts.push(`${timeRemaining.seconds}s`);

    return parts.join(' ');
  };

  return (
    <Card shadow="sm" padding="lg" radius="sm" withBorder className="archive-card-dark">
      <Stack gap="md">
        <Box style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={24} />
          <Title order={3}>Next Meeting</Title>
        </Box>

        <Box>
          <Title order={2} style={{ color: '#f0c98a', fontFamily: 'monospace', fontSize: '2rem' }}>
            {formatCountdown()}
          </Title>
          <Text size="sm" c="dimmed" mt="xs">
            until the meeting starts
          </Text>
        </Box>

        <Stack gap="xs">
          <Title order={4}>{meeting.title}</Title>

          {meeting.location && (
            <Text size="sm">
              <strong>Location:</strong> {meeting.location}
            </Text>
          )}

          <Text size="sm">
            <strong>Starts:</strong>{' '}
            {new Date(meeting.startTime).toLocaleString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>

          <Text size="sm">
            <strong>Ends:</strong>{' '}
            {new Date(meeting.endTime).toLocaleString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>

          {meeting.description && (
            <Text size="sm" mt="xs">
              {meeting.description}
            </Text>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}
