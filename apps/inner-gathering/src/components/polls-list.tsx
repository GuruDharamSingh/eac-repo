/**
 * Polls List Component
 * Client component that fetches and displays both question polls and availability polls
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  Group,
  Paper,
  Progress,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  ArrowRight,
  BarChart3,
  Calendar,
  Clock,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';

interface AvailabilityPoll {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  earliest_time: string;
  latest_time: string;
  status: 'open' | 'locked' | 'cancelled';
  allow_maybe: boolean;
  created_at: string;
  deadline?: string;
  response_count: number;
  creator_name?: string;
}

interface QuestionPoll {
  id: string;
  question: string;
  description?: string;
  pollType: 'single_choice' | 'multi_choice';
  status: 'open' | 'closed' | 'cancelled';
  deadline?: string;
  voteCount: number;
  createdAt: string;
  creatorName?: string;
  options: Array<{
    id: string;
    label: string;
    voteCount: number;
  }>;
}

type CombinedPoll =
  | { kind: 'availability'; data: AvailabilityPoll }
  | { kind: 'question'; data: QuestionPoll };

export function PollsList() {
  const [polls, setPolls] = useState<CombinedPoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPolls() {
      try {
        const [availRes, questionRes] = await Promise.all([
          fetch('/api/polls'),
          fetch('/api/question-polls'),
        ]);

        const availData = availRes.ok ? await availRes.json() : { polls: [] };
        const questionData = questionRes.ok
          ? await questionRes.json()
          : { polls: [] };

        const combined: CombinedPoll[] = [
          ...(availData.polls || []).map((p: AvailabilityPoll) => ({
            kind: 'availability' as const,
            data: p,
          })),
          ...(questionData.polls || []).map((p: QuestionPoll) => ({
            kind: 'question' as const,
            data: p,
          })),
        ].sort((a, b) => {
          const dateA =
            a.kind === 'availability'
              ? a.data.created_at
              : a.data.createdAt;
          const dateB =
            b.kind === 'availability'
              ? b.data.created_at
              : b.data.createdAt;
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        });

        setPolls(combined);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load polls'
        );
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
          <Paper key={i} withBorder radius="sm" p="lg" className="archive-card">
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
      <Paper
        withBorder
        radius="sm"
        p="xl"
        style={{ borderColor: 'var(--mantine-color-red-3)' }}
      >
        <Stack align="center" gap="md">
          <ThemeIcon size={48} radius="sm" color="red" variant="light">
            <Calendar size={24} />
          </ThemeIcon>
          <div style={{ textAlign: 'center' }}>
            <Title order={5} mb={4}>
              Failed to load polls
            </Title>
            <Text size="sm" c="dimmed" mb="md">
              {error}
            </Text>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
        </Stack>
      </Paper>
    );
  }

  if (polls.length === 0) {
    return (
      <Paper
        withBorder
        radius="sm"
        p="xl"
        className="archive-card"
        style={{ borderStyle: 'dashed' }}
      >
        <Stack align="center" gap="md">
          <ThemeIcon size={64} radius="sm" color="archive" variant="light">
            <BarChart3 size={32} />
          </ThemeIcon>
          <div style={{ textAlign: 'center' }}>
            <Title order={4} mb={8}>
              No polls yet
            </Title>
            <Text size="sm" c="dimmed" mb="md">
              Create a quick poll or availability poll to get started
            </Text>
          </div>
          <Button
            component={Link}
            href="/polls/new"
            color="archive"
            leftSection={<BarChart3 size={16} />}
          >
            Create Poll
          </Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <Stack gap="md" pb="lg">
      {polls.map((poll) => {
        if (poll.kind === 'question') {
          return (
            <QuestionPollCard key={`q-${poll.data.id}`} poll={poll.data} />
          );
        }
        return (
          <AvailabilityPollCard
            key={`a-${poll.data.id}`}
            poll={poll.data}
          />
        );
      })}
    </Stack>
  );
}

// ─── Question Poll Card ───

function QuestionPollCard({ poll }: { poll: QuestionPoll }) {
  const isClosed = poll.status === 'closed' || poll.status === 'cancelled';
  const deadlineDate = poll.deadline ? new Date(poll.deadline) : null;
  const isPastDeadline = deadlineDate && deadlineDate < new Date();
  const totalVotes = poll.options.reduce((sum, o) => sum + o.voteCount, 0);

  return (
    <Paper
      withBorder
      radius="sm"
      p="md"
      className="archive-card"
      style={{ opacity: isClosed ? 0.75 : 1 }}
    >
      <Stack gap="md">
        {/* Header */}
        <div>
          <Group gap="xs" mb={4} wrap="wrap">
            <Title order={5}>{poll.question}</Title>
            <Badge
              variant="light"
              color="oxblood"
              size="sm"
              leftSection={<BarChart3 size={12} />}
            >
              Quick Poll
            </Badge>
            <Badge variant="light" color="gray" size="sm">
              {poll.pollType === 'single_choice'
                ? 'Single choice'
                : 'Multi choice'}
            </Badge>
            {poll.status === 'closed' && (
              <Badge variant="light" color="gray" size="sm">
                Closed
              </Badge>
            )}
            {poll.status === 'cancelled' && (
              <Badge variant="light" color="red" size="sm">
                Cancelled
              </Badge>
            )}
            {isPastDeadline && poll.status === 'open' && (
              <Badge variant="light" color="orange" size="sm">
                Past Deadline
              </Badge>
            )}
          </Group>
          {poll.description && (
            <Text size="sm" c="dimmed" lineClamp={2}>
              {poll.description}
            </Text>
          )}
        </div>

        {/* Options preview */}
        {totalVotes > 0 && (
          <Stack gap={4}>
            {poll.options.slice(0, 3).map((option) => {
              const pct =
                totalVotes > 0
                  ? Math.round((option.voteCount / totalVotes) * 100)
                  : 0;
              return (
                <Group key={option.id} gap="xs">
                  <Text size="xs" style={{ flex: 1, minWidth: 0 }} truncate>
                    {option.label}
                  </Text>
                  <Progress
                    value={pct}
                    size="sm"
                    radius="xl"
                    color="oxblood"
                    style={{ flex: 1 }}
                  />
                  <Text size="xs" c="dimmed" w={36} ta="right">
                    {pct}%
                  </Text>
                </Group>
              );
            })}
            {poll.options.length > 3 && (
              <Text size="xs" c="dimmed">
                +{poll.options.length - 3} more options
              </Text>
            )}
          </Stack>
        )}

        {/* Meta */}
        <Group gap="md" wrap="wrap">
          {poll.creatorName && (
            <Group gap={6}>
              <Users size={14} color="var(--mantine-color-gray-6)" />
              <Text size="sm" fw={500}>
                {poll.creatorName}
              </Text>
            </Group>
          )}
          <Group gap={6}>
            <BarChart3 size={14} color="var(--mantine-color-gray-6)" />
            <Text size="sm" c="dimmed">
              {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
            </Text>
          </Group>
          {deadlineDate && (
            <Group gap={6}>
              <Clock
                size={14}
                color={
                  isPastDeadline
                    ? 'var(--mantine-color-red-6)'
                    : 'var(--mantine-color-orange-6)'
                }
              />
              <Text
                size="sm"
                fw={500}
                c={isPastDeadline ? 'red' : 'orange'}
              >
                {isPastDeadline ? 'Ended' : 'Due'}{' '}
                {format(deadlineDate, 'MMM d')}
              </Text>
            </Group>
          )}
        </Group>

        <Button
          component={Link}
          href={`/polls/${poll.id}?type=question`}
          fullWidth
          size="md"
          variant={isClosed ? 'outline' : 'filled'}
          color="oxblood"
          rightSection={!isClosed ? <ArrowRight size={16} /> : undefined}
          disabled={poll.status === 'cancelled'}
        >
          {poll.status === 'cancelled'
            ? 'Cancelled'
            : isClosed
              ? 'View Results'
              : 'Vote Now'}
        </Button>
      </Stack>
    </Paper>
  );
}

// ─── Availability Poll Card ───

function AvailabilityPollCard({ poll }: { poll: AvailabilityPoll }) {
  const isLocked = poll.status === 'locked';
  const isCancelled = poll.status === 'cancelled';
  const createdDate = new Date(poll.created_at);
  const deadlineDate = poll.deadline ? new Date(poll.deadline) : null;
  const isPastDeadline = deadlineDate && deadlineDate < new Date();

  return (
    <Paper
      withBorder
      radius="sm"
      p="md"
      className="archive-card"
      style={{ opacity: isLocked || isCancelled ? 0.75 : 1 }}
    >
      <Stack gap="md">
        {/* Header */}
        <div>
          <Group gap="xs" mb={4} wrap="wrap">
            <Title order={5}>{poll.title}</Title>
            <Badge
              variant="light"
              color="archive"
              size="sm"
              leftSection={<Calendar size={12} />}
            >
              Availability Poll
            </Badge>
            {isLocked && (
              <Badge variant="light" color="green" size="sm">
                Finalized
              </Badge>
            )}
            {isCancelled && (
              <Badge variant="light" color="red" size="sm">
                Cancelled
              </Badge>
            )}
            {isPastDeadline && !isLocked && !isCancelled && (
              <Badge variant="light" color="orange" size="sm">
                Past Deadline
              </Badge>
            )}
          </Group>
          {poll.description && (
            <Text size="sm" c="dimmed" lineClamp={2}>
              {poll.description}
            </Text>
          )}
        </div>

        {/* Date range */}
        <Group gap="xs">
          <Calendar size={14} color="var(--mantine-color-gray-6)" />
          <Text size="sm">
            {format(new Date(poll.start_date), 'MMM d')} -{' '}
            {format(new Date(poll.end_date), 'MMM d, yyyy')}
          </Text>
          <Text size="sm" c="dimmed">
            ({poll.earliest_time} - {poll.latest_time})
          </Text>
        </Group>

        {/* Meta */}
        <Group gap="md" wrap="wrap">
          {poll.creator_name && (
            <Group gap={6}>
              <Users size={14} color="var(--mantine-color-gray-6)" />
              <Text size="sm" fw={500}>
                {poll.creator_name}
              </Text>
            </Group>
          )}
          <Group gap={6}>
            <Clock size={14} color="var(--mantine-color-gray-6)" />
            <Text size="sm" c="dimmed">
              {format(createdDate, 'MMM d, yyyy')}
            </Text>
          </Group>
          {deadlineDate && (
            <Group gap={6}>
              <Calendar
                size={14}
                color={
                  isPastDeadline
                    ? 'var(--mantine-color-red-6)'
                    : 'var(--mantine-color-orange-6)'
                }
              />
              <Text
                size="sm"
                fw={500}
                c={isPastDeadline ? 'red' : 'orange'}
              >
                {isPastDeadline ? 'Deadline passed' : 'Due'}{' '}
                {format(deadlineDate, 'MMM d')}
              </Text>
            </Group>
          )}
          {poll.response_count > 0 && (
            <Badge variant="outline" size="sm">
              {poll.response_count}{' '}
              {poll.response_count === 1 ? 'response' : 'responses'}
            </Badge>
          )}
        </Group>

        {poll.allow_maybe && (
          <Badge variant="outline" size="sm" leftSection={<Clock size={12} />}>
            Maybe option enabled
          </Badge>
        )}

        <Button
          component={Link}
          href={`/polls/${poll.id}`}
          fullWidth
          size="md"
          variant={isLocked || isCancelled ? 'outline' : 'filled'}
          color="archive"
          leftSection={isLocked ? <Users size={16} /> : undefined}
          rightSection={
            !isLocked && !isCancelled ? <ArrowRight size={16} /> : undefined
          }
          disabled={isCancelled}
        >
          {isCancelled
            ? 'Cancelled'
            : isLocked
              ? 'View Results'
              : 'Vote Now'}
        </Button>
      </Stack>
    </Paper>
  );
}
