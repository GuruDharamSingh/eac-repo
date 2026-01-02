/**
 * Poll Voting Component
 * Display poll options and allow voting with When2Meet-style interface
 */

'use client';

import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { Calendar, Clock, Users, CheckCircle2, XCircle, HelpCircle, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

interface Poll {
  id: number;
  type: 'datePoll' | 'textPoll';
  title: string;
  description?: string;
  created: number;
  expire: number;
  ownerDisplayName: string;
  allowMaybe: number;
}

interface PollOption {
  id: number;
  pollId: number;
  pollOptionText: string;
  timestamp?: number;
  order: number;
  duration: number;
}

interface VoteResult {
  option: PollOption;
  yes: number;
  no: number;
  maybe: number;
  total: number;
  availabilityScore: number;
}

type VoteAnswer = 'yes' | 'no' | 'maybe';

export function PollVoting({ pollId }: { pollId: string }) {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [options, setOptions] = useState<PollOption[]>([]);
  const [results, setResults] = useState<VoteResult[]>([]);
  const [votes, setVotes] = useState<Map<number, VoteAnswer>>(new Map());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    async function fetchPollData() {
      try {
        const [pollResponse, resultsResponse] = await Promise.all([
          fetch(`/api/polls/${pollId}`),
          fetch(`/api/polls/${pollId}/vote`),
        ]);

        if (!pollResponse.ok || !resultsResponse.ok) {
          throw new Error('Failed to fetch poll data');
        }

        const pollData = await pollResponse.json();
        const resultsData = await resultsResponse.json();

        setPoll(pollData.poll);
        setOptions(pollData.options);
        setResults(resultsData.results);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load poll');
      } finally {
        setLoading(false);
      }
    }

    fetchPollData();
  }, [pollId]);

  const handleVote = (optionId: number, answer: VoteAnswer) => {
    setVotes((prev) => {
      const newVotes = new Map(prev);
      if (newVotes.get(optionId) === answer) {
        newVotes.delete(optionId); // Toggle off if clicking same answer
      } else {
        newVotes.set(optionId, answer);
      }
      return newVotes;
    });
  };

  const handleSubmit = async () => {
    if (votes.size === 0) {
      alert('Please select your availability for at least one time slot');
      return;
    }

    setSubmitting(true);
    try {
      const votesArray = Array.from(votes.entries()).map(([optionId, answer]) => ({
        optionId,
        answer,
      }));

      const response = await fetch(`/api/polls/${pollId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ votes: votesArray }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit votes');
      }

      // Refresh results
      const resultsResponse = await fetch(`/api/polls/${pollId}/vote`);
      const resultsData = await resultsResponse.json();
      setResults(resultsData.results);
      setShowResults(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit votes');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Paper withBorder radius="lg" p="xl">
        <Text c="dimmed" ta="center">Loading poll...</Text>
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

  const isExpired = poll.expire > 0 && poll.expire * 1000 < Date.now();
  const sortedResults = [...results].sort((a, b) => b.availabilityScore - a.availabilityScore);
  const bestOption = sortedResults[0];

  return (
    <Stack gap="lg">
      {/* Header */}
      <div>
        <Button
          component={Link}
          href="/polls"
          variant="subtle"
          size="sm"
          mb="md"
          leftSection={<ArrowLeft size={16} />}
        >
          Back to Polls
        </Button>
        <Title order={2} mb={8}>{poll.title}</Title>
        {poll.description && (
          <Text c="dimmed">{poll.description}</Text>
        )}
        <Group gap="xs" mt="md">
          <Badge variant="light" leftSection={<Users size={12} />}>
            By {poll.ownerDisplayName}
          </Badge>
          {poll.allowMaybe === 1 && (
            <Badge variant="outline">Maybe allowed</Badge>
          )}
          {isExpired && <Badge color="red">Expired</Badge>}
        </Group>
      </div>

      {/* Toggle View */}
      {!isExpired && (
        <Group gap="xs">
          <Button
            variant={!showResults ? 'filled' : 'outline'}
            onClick={() => setShowResults(false)}
          >
            Vote
          </Button>
          <Button
            variant={showResults ? 'filled' : 'outline'}
            onClick={() => setShowResults(true)}
          >
            View Results
          </Button>
        </Group>
      )}

      {/* Voting Interface */}
      {!showResults && !isExpired && (
        <Paper withBorder radius="lg">
          <Stack gap="md" p="md">
            <div>
              <Title order={4}>Mark Your Availability</Title>
              <Text size="sm" c="dimmed">
                Click on each time slot to indicate when you can attend
              </Text>
            </div>

            {options.map((option) => {
              const userVote = votes.get(option.id);
              const optionDate = option.timestamp
                ? new Date(option.timestamp * 1000)
                : null;

              return (
                <Paper key={option.id} withBorder radius="md" p="md">
                  <Stack gap="sm">
                    <Text fw={500}>
                      {optionDate ? (
                        <Group gap="xs">
                          <Calendar size={16} />
                          {format(optionDate, 'EEEE, MMMM d, yyyy')}
                          <Text span c="dimmed">•</Text>
                          <Clock size={16} />
                          {format(optionDate, 'h:mm a')}
                          {option.duration > 0 && (
                            <Text span size="sm" c="dimmed">
                              ({option.duration} min)
                            </Text>
                          )}
                        </Group>
                      ) : (
                        option.pollOptionText
                      )}
                    </Text>
                    <Group gap="xs">
                      <Button
                        size="sm"
                        variant={userVote === 'yes' ? 'filled' : 'outline'}
                        color={userVote === 'yes' ? 'green' : 'gray'}
                        onClick={() => handleVote(option.id, 'yes')}
                        leftSection={<CheckCircle2 size={16} />}
                      >
                        Yes
                      </Button>
                      {poll.allowMaybe === 1 && (
                        <Button
                          size="sm"
                          variant={userVote === 'maybe' ? 'filled' : 'outline'}
                          color={userVote === 'maybe' ? 'yellow' : 'gray'}
                          onClick={() => handleVote(option.id, 'maybe')}
                          leftSection={<HelpCircle size={16} />}
                        >
                          Maybe
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={userVote === 'no' ? 'filled' : 'outline'}
                        color={userVote === 'no' ? 'red' : 'gray'}
                        onClick={() => handleVote(option.id, 'no')}
                        leftSection={<XCircle size={16} />}
                      >
                        No
                      </Button>
                    </Group>
                  </Stack>
                </Paper>
              );
            })}

            <Button
              fullWidth
              size="md"
              onClick={handleSubmit}
              disabled={submitting || votes.size === 0}
            >
              {submitting ? 'Submitting...' : `Submit Votes (${votes.size} selected)`}
            </Button>
          </Stack>
        </Paper>
      )}

      {/* Results View */}
      {(showResults || isExpired) && (
        <Paper withBorder radius="lg">
          <Stack gap="md" p="md">
            <div>
              <Title order={4}>Results</Title>
              <Text size="sm" c="dimmed">
                {results.length} time slots • {results[0]?.total || 0} responses
              </Text>
            </div>

            {sortedResults.map((result) => {
              const optionDate = result.option.timestamp
                ? new Date(result.option.timestamp * 1000)
                : null;
              const isBest = result === bestOption && result.total > 0;

              return (
                <Paper
                  key={result.option.id}
                  withBorder
                  radius="md"
                  p="md"
                  style={{
                    borderColor: isBest ? 'var(--mantine-color-green-5)' : undefined,
                    backgroundColor: isBest ? 'var(--mantine-color-green-0)' : undefined,
                  }}
                >
                  <Group justify="space-between" mb="sm">
                    <Text fw={500}>
                      {optionDate ? (
                        <Group gap="xs">
                          <Calendar size={16} />
                          {format(optionDate, 'EEE, MMM d')} •{' '}
                          {format(optionDate, 'h:mm a')}
                          {isBest && (
                            <Badge color="green">Best Time</Badge>
                          )}
                        </Group>
                      ) : (
                        result.option.pollOptionText
                      )}
                    </Text>
                    <div style={{ textAlign: 'right' }}>
                      <Text size="xl" fw={700}>
                        {result.availabilityScore}%
                      </Text>
                      <Text size="xs" c="dimmed">
                        {result.total} {result.total === 1 ? 'vote' : 'votes'}
                      </Text>
                    </div>
                  </Group>
                  <Stack gap={4}>
                    <Group gap="xs">
                      <CheckCircle2 size={16} color="var(--mantine-color-green-6)" />
                      <Text size="sm" fw={500}>{result.yes}</Text>
                      <Text size="sm" c="dimmed">Yes</Text>
                    </Group>
                    {poll.allowMaybe === 1 && (
                      <Group gap="xs">
                        <HelpCircle size={16} color="var(--mantine-color-yellow-6)" />
                        <Text size="sm" fw={500}>{result.maybe}</Text>
                        <Text size="sm" c="dimmed">Maybe</Text>
                      </Group>
                    )}
                    <Group gap="xs">
                      <XCircle size={16} color="var(--mantine-color-red-6)" />
                      <Text size="sm" fw={500}>{result.no}</Text>
                      <Text size="sm" c="dimmed">No</Text>
                    </Group>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
