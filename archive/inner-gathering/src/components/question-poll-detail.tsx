/**
 * Question Poll Detail Component
 * Full-page view for voting on a question poll
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Avatar,
  Badge,
  Button,
  Group,
  Paper,
  Progress,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import {
  ArrowLeft,
  BarChart3,
  Check,
  Clock,
  Users,
} from 'lucide-react';
import Link from 'next/link';

interface PollOption {
  id: string;
  label: string;
  voteCount: number;
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
  options: PollOption[];
}

export function QuestionPollDetail({ pollId }: { pollId: string }) {
  const [poll, setPoll] = useState<QuestionPoll | null>(null);
  const [userVotes, setUserVotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);

  const fetchPoll = useCallback(async () => {
    try {
      const res = await fetch(`/api/question-polls/${pollId}`);
      if (!res.ok) throw new Error('Failed to fetch poll');
      const data = await res.json();
      setPoll(data.poll);
      setUserVotes(data.userVotes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load poll');
    } finally {
      setLoading(false);
    }
  }, [pollId]);

  useEffect(() => {
    fetchPoll();
  }, [fetchPoll]);

  const handleVote = async (optionId: string) => {
    if (isVoting) return;
    setIsVoting(true);
    try {
      const res = await fetch(`/api/question-polls/${pollId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.poll) setPoll(data.poll);
        if (data.userVotes) setUserVotes(data.userVotes);
      }
    } catch {
      // Silently fail
    } finally {
      setIsVoting(false);
    }
  };

  if (loading) {
    return (
      <Paper withBorder radius="lg" p="xl">
        <Text c="dimmed" ta="center">
          Loading poll...
        </Text>
      </Paper>
    );
  }

  if (error || !poll) {
    return (
      <Paper withBorder radius="lg" p="xl">
        <Stack align="center" gap="md">
          <Text c="red">{error || 'Poll not found'}</Text>
          <Button component={Link} href="/polls" variant="outline">
            Back to Polls
          </Button>
        </Stack>
      </Paper>
    );
  }

  const hasVoted = userVotes.length > 0;
  const isOpen = poll.status === 'open';
  const isPastDeadline =
    poll.deadline && new Date(poll.deadline) < new Date();
  const canVote = isOpen && !isPastDeadline;
  const showResults = hasVoted || !canVote;
  const totalVotes = poll.options.reduce((sum, o) => sum + o.voteCount, 0);

  return (
    <Stack gap="lg">
      {/* Back button */}
      <Button
        component={Link}
        href="/polls"
        variant="subtle"
        size="sm"
        leftSection={<ArrowLeft size={16} />}
      >
        Back to Polls
      </Button>

      {/* Header */}
      <div>
        <Title order={2} mb={8}>
          {poll.question}
        </Title>
        {poll.description && <Text c="dimmed">{poll.description}</Text>}
        <Group gap="xs" mt="md">
          <Badge
            variant="light"
            color="violet"
            leftSection={<BarChart3 size={12} />}
          >
            Quick Poll
          </Badge>
          <Badge variant="light" color="gray">
            {poll.pollType === 'single_choice'
              ? 'Single choice'
              : 'Multiple choice'}
          </Badge>
          {poll.creatorName && (
            <Badge variant="light" leftSection={<Users size={12} />}>
              By {poll.creatorName}
            </Badge>
          )}
          {poll.status === 'closed' && (
            <Badge color="gray">Closed</Badge>
          )}
          {isPastDeadline && poll.status === 'open' && (
            <Badge color="orange">Deadline passed</Badge>
          )}
          <Badge variant="outline">
            {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
          </Badge>
        </Group>
      </div>

      {/* Voting / Results */}
      <Paper withBorder radius="lg">
        <Stack gap="md" p="md">
          <Title order={4}>
            {showResults ? 'Results' : 'Cast Your Vote'}
          </Title>

          {poll.options.map((option) => {
            const pct =
              totalVotes > 0
                ? Math.round((option.voteCount / totalVotes) * 100)
                : 0;
            const isSelected = userVotes.includes(option.id);

            if (showResults) {
              return (
                <Paper
                  key={option.id}
                  withBorder
                  radius="md"
                  p="md"
                  style={{
                    borderColor: isSelected
                      ? 'var(--mantine-color-indigo-4)'
                      : undefined,
                    backgroundColor: isSelected
                      ? 'var(--mantine-color-indigo-0)'
                      : undefined,
                  }}
                >
                  <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                      {isSelected && (
                        <Check
                          size={16}
                          color="var(--mantine-color-indigo-6)"
                        />
                      )}
                      <Text fw={isSelected ? 600 : 400}>{option.label}</Text>
                    </Group>
                    <Group gap="xs">
                      <Text fw={700}>{pct}%</Text>
                      <Text size="sm" c="dimmed">
                        ({option.voteCount})
                      </Text>
                    </Group>
                  </Group>
                  <Progress
                    value={pct}
                    size="md"
                    radius="xl"
                    color={isSelected ? 'indigo' : 'gray'}
                  />
                </Paper>
              );
            }

            return (
              <Button
                key={option.id}
                variant="outline"
                color="gray"
                fullWidth
                justify="flex-start"
                size="lg"
                onClick={() => handleVote(option.id)}
                loading={isVoting}
                styles={{ label: { fontWeight: 400 } }}
              >
                {option.label}
              </Button>
            );
          })}
        </Stack>
      </Paper>

      {/* Footer info */}
      <Group gap="md">
        <Group gap={6}>
          <Users size={14} color="var(--mantine-color-gray-6)" />
          <Text size="sm" c="dimmed">
            {totalVotes} total {totalVotes === 1 ? 'vote' : 'votes'}
          </Text>
        </Group>
        {poll.deadline && (
          <Group gap={6}>
            <Clock size={14} color="var(--mantine-color-gray-6)" />
            <Text size="sm" c="dimmed">
              {isPastDeadline
                ? 'Deadline passed'
                : `Deadline: ${new Date(poll.deadline).toLocaleDateString()}`}
            </Text>
          </Group>
        )}
      </Group>
    </Stack>
  );
}
