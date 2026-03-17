'use client';

import { Paper, Title, Text, Badge, Button, Group, Stack, Divider } from '@mantine/core';
import { IconCalendar, IconMapPin, IconClock } from '@tabler/icons-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Meeting } from '@/lib/types';

interface SadhanaCardProps {
  meeting: Meeting | null;
}

export function SadhanaCard({ meeting }: SadhanaCardProps) {
  if (!meeting) {
    return (
      <Paper
        p="xl"
        className="card-natural"
      >
        <Stack align="center" gap="sm" py="md">
          <Text size="lg" c="dimmed" ta="center" style={{ fontStyle: 'italic' }}>
            No upcoming sadhana scheduled yet.
          </Text>
          <Text size="sm" c="dimmed" ta="center">
            Check back soon — gatherings are announced monthly.
          </Text>
        </Stack>
      </Paper>
    );
  }

  const date = meeting.scheduled_at ? new Date(meeting.scheduled_at) : null;

  return (
    <Paper
      p="xl"
      className="card-natural"
    >
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Badge
            size="lg"
            variant="filled"
            style={{
              background: 'linear-gradient(90deg, var(--saffron-bright), var(--saffron-medium))',
              color: 'var(--charcoal)',
              fontFamily: "'Cinzel', serif",
              fontWeight: 700,
              letterSpacing: '0.05em',
              border: 'none',
              height: '32px'
            }}
          >
            Next Sadhana
          </Badge>
        </Group>

        <Title
          order={3}
          style={{
            fontFamily: "'Cinzel', serif",
            color: 'var(--charcoal)',
            fontSize: '1.5rem',
            fontWeight: 700
          }}
        >
          {meeting.title}
        </Title>

        <Divider color="rgba(244, 196, 48, 0.4)" />

        <Stack gap="xs">
          {date && (
            <Group gap="xs">
              <IconCalendar size={20} color="var(--saffron-medium)" />
              <Text size="md" style={{ color: 'var(--charcoal)', fontWeight: 500 }}>
                {format(date, 'EEEE, MMMM d, yyyy')}
              </Text>
            </Group>
          )}

          {date && (
            <Group gap="xs">
              <IconClock size={20} color="var(--saffron-medium)" />
              <Text size="md" style={{ color: 'var(--charcoal)', fontWeight: 500 }}>
                {format(date, 'h:mm a')} · 2.5 hours
              </Text>
            </Group>
          )}

          {meeting.location && (
            <Group gap="xs">
              <IconMapPin size={20} color="var(--saffron-medium)" />
              <Text size="md" style={{ color: 'var(--charcoal)', fontWeight: 500 }}>
                {meeting.location}
              </Text>
            </Group>
          )}
        </Stack>

        {meeting.description && (
          <Text size="sm" style={{ color: 'var(--charcoal)', opacity: 0.8, lineHeight: 1.7 }}>
            {meeting.description}
          </Text>
        )}

        <Button
          component={Link}
          href={`/meetings/${meeting.id}`}
          size="lg"
          style={{
            background: 'linear-gradient(135deg, var(--saffron-bright), var(--terracotta-light))',
            color: 'white',
            fontWeight: 700,
            borderRadius: '12px',
            border: 'none',
            boxShadow: '0 4px 16px rgba(244, 196, 48, 0.4)',
            marginTop: '0.5rem'
          }}
        >
          View Details & RSVP
        </Button>
      </Stack>
    </Paper>
  );
}
