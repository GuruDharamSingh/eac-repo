/**
 * Polls List Component
 * Client component that fetches and displays polls from Nextcloud
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { Calendar, Clock, Users, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

interface Poll {
  id: number;
  type: 'datePoll' | 'textPoll';
  title: string;
  description?: string;
  created: number;
  expire: number;
  ownerDisplayName: string;
  access: string;
  allowMaybe: number;
}

export function PollsList() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPolls() {
      try {
        const response = await fetch('/api/polls');
        if (!response.ok) {
          throw new Error('Failed to fetch polls');
        }
        const data = await response.json();
        setPolls(data.polls || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load polls');
      } finally {
        setLoading(false);
      }
    }

    fetchPolls();
  }, []);

  if (loading) {
    return (
      <Stack gap="md">
        {[1, 2, 3].map((i) => (
          <Paper key={i} withBorder radius="lg" p="lg">
            <Stack gap="md">
              <Skeleton height={20} width="75%" />
              <Skeleton height={16} width="50%" />
              <Skeleton height={16} width="66%" />
            </Stack>
          </Paper>
        ))}
      </Stack>
    );
  }

  if (error) {
    return (
      <Paper withBorder radius="lg" p="xl" style={{ borderColor: 'var(--mantine-color-red-3)' }}>
        <Stack align="center" gap="md">
          <ThemeIcon size={48} radius="xl" color="red" variant="light">
            <Calendar size={24} />
          </ThemeIcon>
          <div style={{ textAlign: 'center' }}>
            <Title order={5} mb={4}>Failed to load polls</Title>
            <Text size="sm" c="dimmed" mb="md">{error}</Text>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </Stack>
      </Paper>
    );
  }

  if (polls.length === 0) {
    return (
      <Paper withBorder radius="lg" p="xl" style={{ borderStyle: 'dashed' }}>
        <Stack align="center" gap="md">
          <ThemeIcon size={64} radius="xl" color="indigo" variant="light">
            <Calendar size={32} />
          </ThemeIcon>
          <div style={{ textAlign: 'center' }}>
            <Title order={4} mb={8}>No polls yet</Title>
            <Text size="sm" c="dimmed" mb="md">
              Create your first availability poll to get started
            </Text>
          </div>
          <Button component={Link} href="/polls/new" leftSection={<Calendar size={16} />}>
            Create Poll
          </Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <Stack gap="md" pb="lg">
      {polls.map((poll) => {
        const isExpired = poll.expire > 0 && poll.expire * 1000 < Date.now();
        const createdDate = new Date(poll.created * 1000);
        const expireDate = poll.expire > 0 ? new Date(poll.expire * 1000) : null;

        return (
          <Paper
            key={poll.id}
            withBorder
            radius="lg"
            p="md"
            style={{ opacity: isExpired ? 0.75 : 1 }}
          >
            <Stack gap="md">
              {/* Header */}
              <div>
                <Group gap="xs" mb={4} wrap="wrap">
                  <Title order={5}>{poll.title}</Title>
                  {poll.type === 'datePoll' && (
                    <Badge variant="light" color="blue" size="sm" leftSection={<Calendar size={12} />}>
                      Time Poll
                    </Badge>
                  )}
                  {isExpired && (
                    <Badge variant="light" color="red" size="sm">
                      Expired
                    </Badge>
                  )}
                </Group>
                {poll.description && (
                  <Text size="sm" c="dimmed" lineClamp={2}>
                    {poll.description}
                  </Text>
                )}
              </div>

              {/* Meta info */}
              <Group gap="md" wrap="wrap">
                <Group gap={6}>
                  <Users size={14} color="var(--mantine-color-gray-6)" />
                  <Text size="sm" fw={500}>{poll.ownerDisplayName}</Text>
                </Group>
                <Group gap={6}>
                  <Clock size={14} color="var(--mantine-color-gray-6)" />
                  <Text size="sm" c="dimmed">{format(createdDate, 'MMM d, yyyy')}</Text>
                </Group>
                {expireDate && (
                  <Group gap={6}>
                    <Calendar size={14} color={isExpired ? 'var(--mantine-color-red-6)' : 'var(--mantine-color-orange-6)'} />
                    <Text size="sm" fw={500} c={isExpired ? 'red' : 'orange'}>
                      {isExpired ? 'Expired' : 'Due'} {format(expireDate, 'MMM d')}
                    </Text>
                  </Group>
                )}
              </Group>

              {poll.allowMaybe === 1 && (
                <Badge variant="outline" size="sm" leftSection={<Clock size={12} />}>
                  Maybe option enabled
                </Badge>
              )}

              <Button
                component={Link}
                href={`/polls/${poll.id}`}
                fullWidth
                size="md"
                variant={isExpired ? 'outline' : 'filled'}
                leftSection={isExpired ? <Users size={16} /> : undefined}
                rightSection={!isExpired ? <ArrowRight size={16} /> : undefined}
              >
                {isExpired ? 'View Results' : 'Vote Now'}
              </Button>
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}
