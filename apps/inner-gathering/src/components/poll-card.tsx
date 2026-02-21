/**
 * Poll Card Component
 * Displays a question poll inline in the feed with voting and results
 */

'use client';

import { useState, useCallback } from 'react';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Progress,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { BarChart3, Check, Clock, Users } from 'lucide-react';
import type { QuestionPoll, PollOption } from '@elkdonis/services';

interface PollCardProps {
  poll: QuestionPoll;
}

export function PollCard({ poll }: PollCardProps) {
  const [currentPoll, setCurrentPoll] = useState(poll);
  const [userVotes, setUserVotes] = useState<string[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [checkedInitialVotes, setCheckedInitialVotes] = useState(false);

  // Check if user has already voted on mount
  const checkExistingVotes = useCallback(async () => {
    if (checkedInitialVotes) return;
    try {
      const res = await fetch(`/api/question-polls/${poll.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.userVotes && data.userVotes.length > 0) {
          setUserVotes(data.userVotes);
          setHasVoted(true);
        }
        if (data.poll) {
          setCurrentPoll(data.poll);
        }
      }
    } catch {
      // Silently fail
    } finally {
      setCheckedInitialVotes(true);
    }
  }, [poll.id, checkedInitialVotes]);

  // Trigger check on first render
  if (!checkedInitialVotes) {
    checkExistingVotes();
  }

  const totalVotes = currentPoll.options.reduce(
    (sum, o) => sum + o.voteCount,
    0
  );

  const isOpen = currentPoll.status === 'open';
  const isPastDeadline =
    currentPoll.deadline && new Date(currentPoll.deadline) < new Date();
  const canVote = isOpen && !isPastDeadline;

  const handleVote = async (optionId: string) => {
    if (!canVote || isVoting) return;

    setIsVoting(true);
    try {
      const res = await fetch(`/api/question-polls/${poll.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.poll) setCurrentPoll(data.poll);
        if (data.userVotes) setUserVotes(data.userVotes);
        setHasVoted(true);
      }
    } catch {
      // Silently fail
    } finally {
      setIsVoting(false);
    }
  };

  const getPercentage = (option: PollOption) => {
    if (totalVotes === 0) return 0;
    return Math.round((option.voteCount / totalVotes) * 100);
  };

  const timeRemaining = currentPoll.deadline
    ? getTimeRemaining(new Date(currentPoll.deadline))
    : null;

  return (
    <Paper withBorder radius="lg" p="md">
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs" style={{ flex: 1 }}>
            <Title order={4}>{currentPoll.question}</Title>
            <Group gap="xs">
              <Badge
                variant="light"
                color="violet"
                leftSection={<BarChart3 size={12} />}
              >
                Poll
              </Badge>
              <Badge variant="light" color="gray" size="sm">
                {currentPoll.pollType === 'single_choice'
                  ? 'Single choice'
                  : 'Multiple choice'}
              </Badge>
              {currentPoll.status === 'closed' && (
                <Badge variant="light" color="gray">
                  Closed
                </Badge>
              )}
              {isPastDeadline && currentPoll.status === 'open' && (
                <Badge variant="light" color="orange">
                  Deadline passed
                </Badge>
              )}
            </Group>
          </Stack>
        </Group>

        {/* Description */}
        {currentPoll.description && (
          <Text size="sm" c="dimmed">
            {currentPoll.description}
          </Text>
        )}

        {/* Options — voting or results */}
        <Stack gap="xs">
          {currentPoll.options.map((option) => {
            const pct = getPercentage(option);
            const isSelected = userVotes.includes(option.id);
            const showResults = hasVoted || !canVote;

            if (showResults) {
              // Results view — progress bars
              return (
                <Paper
                  key={option.id}
                  withBorder
                  radius="md"
                  p="sm"
                  style={{
                    borderColor: isSelected
                      ? 'var(--mantine-color-indigo-4)'
                      : undefined,
                    backgroundColor: isSelected
                      ? 'var(--mantine-color-indigo-0)'
                      : undefined,
                  }}
                >
                  <Group justify="space-between" mb={4}>
                    <Group gap="xs">
                      {isSelected && (
                        <Check
                          size={14}
                          color="var(--mantine-color-indigo-6)"
                        />
                      )}
                      <Text size="sm" fw={isSelected ? 600 : 400}>
                        {option.label}
                      </Text>
                    </Group>
                    <Text size="sm" fw={600} c="dimmed">
                      {pct}%
                    </Text>
                  </Group>
                  <Progress
                    value={pct}
                    size="sm"
                    radius="xl"
                    color={isSelected ? 'indigo' : 'gray'}
                  />
                </Paper>
              );
            }

            // Voting view — clickable buttons
            return (
              <Button
                key={option.id}
                variant="outline"
                color="gray"
                fullWidth
                justify="flex-start"
                size="md"
                onClick={() => handleVote(option.id)}
                loading={isVoting}
                styles={{
                  label: { fontWeight: 400 },
                }}
              >
                {option.label}
              </Button>
            );
          })}
        </Stack>

        {/* Footer */}
        <Group gap="md">
          <Group gap={6}>
            <Users size={14} color="var(--mantine-color-gray-6)" />
            <Text size="xs" c="dimmed">
              {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
            </Text>
          </Group>
          {timeRemaining && canVote && (
            <Group gap={6}>
              <Clock size={14} color="var(--mantine-color-gray-6)" />
              <Text size="xs" c="dimmed">
                {timeRemaining}
              </Text>
            </Group>
          )}
          {currentPoll.creatorName && (
            <Group gap={6}>
              <Avatar size="xs" radius="xl" color="violet">
                {currentPoll.creatorName[0]}
              </Avatar>
              <Text size="xs" c="dimmed">
                {currentPoll.creatorName}
              </Text>
            </Group>
          )}
        </Group>
      </Stack>
    </Paper>
  );
}

function getTimeRemaining(deadline: Date): string | null {
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();

  if (diff <= 0) return null;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d left`;
  if (hours > 0) return `${hours}h left`;

  const minutes = Math.floor(diff / (1000 * 60));
  return `${minutes}m left`;
}
