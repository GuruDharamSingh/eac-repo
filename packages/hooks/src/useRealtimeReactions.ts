import { useState, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useRealtimeSubscription } from './useRealtimeSubscription';

interface ReactionEvent {
  id: string;
  userId: string;
  reactionType: string;
  type: 'add' | 'remove';
  timestamp: Date;
}

interface UseRealtimeReactionsOptions {
  client: SupabaseClient;
  targetId: string;
  targetType: 'post' | 'meeting' | 'reply';
  enabled?: boolean;
}

export function useRealtimeReactions({
  client,
  targetId,
  targetType,
  enabled = true,
}: UseRealtimeReactionsOptions) {
  const [reactionCount, setReactionCount] = useState<number | null>(null);
  const [recentEvents, setRecentEvents] = useState<ReactionEvent[]>([]);

  const addEvent = useCallback((event: ReactionEvent) => {
    setRecentEvents((prev) => [event, ...prev].slice(0, 10));
    // Auto-clear animation events after 3 seconds
    setTimeout(() => {
      setRecentEvents((prev) => prev.filter((e) => e.id !== event.id));
    }, 3000);
  }, []);

  useRealtimeSubscription<Record<string, unknown>>({
    client,
    table: 'reactions',
    event: 'INSERT',
    filter: `reactable_id=eq.${targetId}`,
    onInsert: (payload) => {
      if (payload.reactable_type !== targetType) return;
      setReactionCount((prev) => (prev !== null ? prev + 1 : null));
      addEvent({
        id: payload.id as string,
        userId: payload.user_id as string,
        reactionType: payload.reaction_type as string,
        type: 'add',
        timestamp: new Date(),
      });
    },
    enabled,
  });

  useRealtimeSubscription<Record<string, unknown>>({
    client,
    table: 'reactions',
    event: 'DELETE',
    filter: `reactable_id=eq.${targetId}`,
    onDelete: (payload) => {
      if (payload.reactable_type !== targetType) return;
      setReactionCount((prev) => (prev !== null && prev > 0 ? prev - 1 : null));
      addEvent({
        id: payload.id as string,
        userId: payload.user_id as string,
        reactionType: payload.reaction_type as string,
        type: 'remove',
        timestamp: new Date(),
      });
    },
    enabled,
  });

  const initializeCount = useCallback((count: number) => {
    setReactionCount(count);
  }, []);

  return {
    reactionCount,
    recentEvents,
    initializeCount,
  };
}
