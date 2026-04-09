/**
 * Poll Voting Component
 * Display poll time slots and allow voting with When2Meet-style interface
 * Includes live vote result updates via Supabase Realtime
 */

'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Title,
  Transition,
} from '@mantine/core';
import { Calendar, Clock, Users, CheckCircle2, XCircle, HelpCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { format, addMinutes, eachDayOfInterval, isBefore } from 'date-fns';
import Link from 'next/link';
import { useRealtimePollVotes } from '@elkdonis/hooks';
import { supabase } from '@/lib/supabase';

interface Poll {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  earliest_time: string;
  latest_time: string;
  time_slot_duration: number;
  status: 'open' | 'locked' | 'cancelled';
  allow_maybe: boolean;
  creator_name?: string;
  response_count: number;
}

interface SummarySlot {
  time_slot: string;
  total_responses: number;
  yes_count: number;
  maybe_count: number;
  no_count: number;
  availability_score: number;
}

type VoteAnswer = 'yes' | 'no' | 'maybe';

export function PollVoting({ pollId }: { pollId: string }) {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [summary, setSummary] = useState<SummarySlot[]>([]);
  const [votes, setVotes] = useState<Map<string, VoteAnswer>>(new Map());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Refresh summary when new votes arrive via realtime
  const refreshSummary = useCallback(async () => {
    if (!pollId) return;
    try {
      const summaryResponse = await fetch(`/api/polls/${pollId}/vote`);
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        setSummary(summaryData.summary || []);
      }
    } catch {
      // Silently ignore refresh failures
    }
  }, [pollId]);

  // Realtime poll vote subscription
  const { hasNewVotes, acknowledgeNewVotes } = useRealtimePollVotes({
    client: supabase,
    pollId,
    onNewVote: refreshSummary,
  });

  // Generate time slots from poll date/time range
  const timeSlots = useMemo(() => {
    if (!poll) return [];

    const slots: Date[] = [];
    const startDate = new Date(poll.start_date);
    const endDate = new Date(poll.end_date);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    for (const day of days) {
      // Parse earliest and latest times
      const [earliestHour, earliestMinute] = poll.earliest_time.split(':').map(Number);
      const [latestHour, latestMinute] = poll.latest_time.split(':').map(Number);

      let slotTime = new Date(day);
      slotTime.setHours(earliestHour, earliestMinute, 0, 0);

      const dayEnd = new Date(day);
      dayEnd.setHours(latestHour, latestMinute, 0, 0);

      while (isBefore(slotTime, dayEnd) || slotTime.getTime() === dayEnd.getTime()) {
        slots.push(new Date(slotTime));
        slotTime = addMinutes(slotTime, poll.time_slot_duration);
      }
    }

    return slots;
  }, [poll]);

  useEffect(() => {
    async function fetchPollData() {
      try {
        const [pollResponse, summaryResponse] = await Promise.all([
          fetch(`/api/polls/${pollId}`),
          fetch(`/api/polls/${pollId}/vote`),
        ]);

        if (!pollResponse.ok) {
          throw new Error('Failed to fetch poll');
        }

        const pollData = await pollResponse.json();
        setPoll(pollData.poll);

        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          setSummary(summaryData.summary || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load poll');
      } finally {
        setLoading(false);
      }
    }

    fetchPollData();
  }, [pollId]);

  const handleVote = (slotIso: string, answer: VoteAnswer) => {
    setVotes((prev) => {
      const newVotes = new Map(prev);
      if (newVotes.get(slotIso) === answer) {
        newVotes.delete(slotIso);
      } else {
        newVotes.set(slotIso, answer);
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
      const slotsArray = Array.from(votes.entries()).map(([time_slot, availability]) => ({
        time_slot,
        availability,
      }));

      const response = await fetch(`/api/polls/${pollId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slots: slotsArray,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit votes');
      }

      // Refresh summary
      const summaryResponse = await fetch(`/api/polls/${pollId}/vote`);
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        setSummary(summaryData.summary || []);
      }
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

  const isLocked = poll.status === 'locked';
  const isCancelled = poll.status === 'cancelled';
  const sortedSummary = [...summary].sort((a, b) => b.availability_score - a.availability_score);
  const bestSlot = sortedSummary[0];

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
          {poll.creator_name && (
            <Badge variant="light" leftSection={<Users size={12} />}>
              By {poll.creator_name}
            </Badge>
          )}
          {poll.allow_maybe && (
            <Badge variant="outline">Maybe allowed</Badge>
          )}
          {isLocked && <Badge color="green">Finalized</Badge>}
          {isCancelled && <Badge color="red">Cancelled</Badge>}
          {poll.response_count > 0 && (
            <Badge variant="outline">{poll.response_count} responses</Badge>
          )}
        </Group>
      </div>

      {/* Toggle View */}
      {!isLocked && !isCancelled && (
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
      {!showResults && !isLocked && !isCancelled && (
        <Paper withBorder radius="lg">
          <Stack gap="md" p="md">
            <div>
              <Title order={4}>Mark Your Availability</Title>
              <Text size="sm" c="dimmed">
                Click on each time slot to indicate when you can attend
              </Text>
            </div>

            {timeSlots.map((slot) => {
              const slotIso = slot.toISOString();
              const userVote = votes.get(slotIso);

              return (
                <Paper key={slotIso} withBorder radius="md" p="md">
                  <Stack gap="sm">
                    <Text fw={500}>
                      <Group gap="xs">
                        <Calendar size={16} />
                        {format(slot, 'EEEE, MMMM d, yyyy')}
                        <Text span c="dimmed">•</Text>
                        <Clock size={16} />
                        {format(slot, 'h:mm a')}
                        <Text span size="sm" c="dimmed">
                          ({poll.time_slot_duration} min)
                        </Text>
                      </Group>
                    </Text>
                    <Group gap="xs">
                      <Button
                        size="sm"
                        variant={userVote === 'yes' ? 'filled' : 'outline'}
                        color={userVote === 'yes' ? 'green' : 'gray'}
                        onClick={() => handleVote(slotIso, 'yes')}
                        leftSection={<CheckCircle2 size={16} />}
                      >
                        Yes
                      </Button>
                      {poll.allow_maybe && (
                        <Button
                          size="sm"
                          variant={userVote === 'maybe' ? 'filled' : 'outline'}
                          color={userVote === 'maybe' ? 'yellow' : 'gray'}
                          onClick={() => handleVote(slotIso, 'maybe')}
                          leftSection={<HelpCircle size={16} />}
                        >
                          Maybe
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={userVote === 'no' ? 'filled' : 'outline'}
                        color={userVote === 'no' ? 'red' : 'gray'}
                        onClick={() => handleVote(slotIso, 'no')}
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
      {(showResults || isLocked || isCancelled) && (
        <Paper withBorder radius="lg">
          <Stack gap="md" p="md">
            <div>
              <Title order={4}>Results</Title>
              <Text size="sm" c="dimmed">
                {summary.length} time slots with votes • {poll.response_count} total responses
              </Text>
            </div>

            {/* Live update indicator */}
            <Transition mounted={hasNewVotes} transition="fade" duration={200}>
              {(styles) => (
                <Paper
                  p="xs"
                  radius="md"
                  style={{
                    ...styles,
                    backgroundColor: 'var(--mantine-color-green-0)',
                    borderColor: 'var(--mantine-color-green-4)',
                  }}
                  withBorder
                >
                  <Group justify="center" gap="xs">
                    <RefreshCw size={14} color="var(--mantine-color-green-6)" />
                    <Text size="xs" c="green" fw={500}>Results updated live</Text>
                  </Group>
                </Paper>
              )}
            </Transition>

            {sortedSummary.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">
                No votes yet. Be the first to vote!
              </Text>
            ) : (
              sortedSummary.map((result) => {
                const slotDate = new Date(result.time_slot);
                const isBest = result === bestSlot && result.total_responses > 0;

                return (
                  <Paper
                    key={result.time_slot}
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
                        <Group gap="xs">
                          <Calendar size={16} />
                          {format(slotDate, 'EEE, MMM d')} •{' '}
                          {format(slotDate, 'h:mm a')}
                          {isBest && (
                            <Badge color="green">Best Time</Badge>
                          )}
                        </Group>
                      </Text>
                      <div style={{ textAlign: 'right' }}>
                        <Text size="xl" fw={700}>
                          {result.availability_score}%
                        </Text>
                        <Text size="xs" c="dimmed">
                          {result.total_responses} {result.total_responses === 1 ? 'vote' : 'votes'}
                        </Text>
                      </div>
                    </Group>
                    <Stack gap={4}>
                      <Group gap="xs">
                        <CheckCircle2 size={16} color="var(--mantine-color-green-6)" />
                        <Text size="sm" fw={500}>{result.yes_count}</Text>
                        <Text size="sm" c="dimmed">Yes</Text>
                      </Group>
                      {poll.allow_maybe && (
                        <Group gap="xs">
                          <HelpCircle size={16} color="var(--mantine-color-yellow-6)" />
                          <Text size="sm" fw={500}>{result.maybe_count}</Text>
                          <Text size="sm" c="dimmed">Maybe</Text>
                        </Group>
                      )}
                      <Group gap="xs">
                        <XCircle size={16} color="var(--mantine-color-red-6)" />
                        <Text size="sm" fw={500}>{result.no_count}</Text>
                        <Text size="sm" c="dimmed">No</Text>
                      </Group>
                    </Stack>
                  </Paper>
                );
              })
            )}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
