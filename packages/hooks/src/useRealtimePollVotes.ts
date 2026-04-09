import { useState, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useRealtimeSubscription } from './useRealtimeSubscription';

interface SummarySlot {
  time_slot: string;
  total_responses: number;
  yes_count: number;
  maybe_count: number;
  no_count: number;
  availability_score: number;
}

interface UseRealtimePollVotesOptions {
  client: SupabaseClient;
  pollId: string;
  enabled?: boolean;
  onNewVote?: () => void;
}

export function useRealtimePollVotes({
  client,
  pollId,
  enabled = true,
  onNewVote,
}: UseRealtimePollVotesOptions) {
  const [voteCount, setVoteCount] = useState(0);
  const [hasNewVotes, setHasNewVotes] = useState(false);

  // Listen for new responses (someone started voting)
  useRealtimeSubscription<Record<string, unknown>>({
    client,
    table: 'availability_responses',
    event: 'INSERT',
    filter: `poll_id=eq.${pollId}`,
    onInsert: () => {
      setVoteCount((prev) => prev + 1);
      setHasNewVotes(true);
      onNewVote?.();
    },
    enabled,
  });

  // Listen for individual slot votes (finer-grained updates)
  useRealtimeSubscription<Record<string, unknown>>({
    client,
    table: 'availability_slots',
    event: '*',
    onInsert: () => {
      setHasNewVotes(true);
      onNewVote?.();
    },
    enabled,
  });

  const acknowledgeNewVotes = useCallback(() => {
    setHasNewVotes(false);
  }, []);

  return {
    voteCount,
    hasNewVotes,
    acknowledgeNewVotes,
  };
}
