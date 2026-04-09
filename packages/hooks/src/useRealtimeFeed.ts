import { useState, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useRealtimeSubscription } from './useRealtimeSubscription';

interface FeedItem {
  type: 'meeting' | 'post';
  data: Record<string, unknown>;
  createdAt: Date;
}

interface UseRealtimeFeedOptions {
  client: SupabaseClient;
  orgId: string;
  enabled?: boolean;
}

export function useRealtimeFeed({ client, orgId, enabled = true }: UseRealtimeFeedOptions) {
  const [newItems, setNewItems] = useState<FeedItem[]>([]);
  const [hasNewItems, setHasNewItems] = useState(false);

  // Listen for new posts
  useRealtimeSubscription<Record<string, unknown>>({
    client,
    table: 'posts',
    event: 'INSERT',
    filter: `org_id=eq.${orgId}`,
    onInsert: (payload) => {
      const item: FeedItem = {
        type: 'post',
        data: payload,
        createdAt: new Date(payload.created_at as string || Date.now()),
      };
      setNewItems((prev) => [item, ...prev]);
      setHasNewItems(true);
    },
    enabled,
  });

  // Listen for new meetings
  useRealtimeSubscription<Record<string, unknown>>({
    client,
    table: 'meetings',
    event: 'INSERT',
    filter: `org_id=eq.${orgId}`,
    onInsert: (payload) => {
      const item: FeedItem = {
        type: 'meeting',
        data: payload,
        createdAt: new Date(payload.created_at as string || Date.now()),
      };
      setNewItems((prev) => [item, ...prev]);
      setHasNewItems(true);
    },
    enabled,
  });

  const consumeNewItems = useCallback(() => {
    const items = [...newItems];
    setNewItems([]);
    setHasNewItems(false);
    return items;
  }, [newItems]);

  const clearNewItems = useCallback(() => {
    setNewItems([]);
    setHasNewItems(false);
  }, []);

  return {
    newItems,
    hasNewItems,
    newItemCount: newItems.length,
    consumeNewItems,
    clearNewItems,
  };
}
