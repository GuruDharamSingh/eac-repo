import { useState, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useRealtimeSubscription } from './useRealtimeSubscription';

interface Notification {
  id: string;
  userId: string;
  actorId?: string;
  type: string;
  notifiableType: string;
  notifiableId: string;
  content?: string;
  metadata?: Record<string, unknown>;
  readAt?: string;
  createdAt: string;
}

interface UseRealtimeNotificationsOptions {
  client: SupabaseClient;
  userId: string;
  enabled?: boolean;
}

export function useRealtimeNotifications({
  client,
  userId,
  enabled = true,
}: UseRealtimeNotificationsOptions) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<Notification[]>([]);

  useRealtimeSubscription<Record<string, unknown>>({
    client,
    table: 'notifications',
    event: 'INSERT',
    filter: `user_id=eq.${userId}`,
    onInsert: (payload) => {
      const notification: Notification = {
        id: payload.id as string,
        userId: payload.user_id as string,
        actorId: payload.actor_id as string | undefined,
        type: payload.notification_type as string,
        notifiableType: payload.notifiable_type as string,
        notifiableId: payload.notifiable_id as string,
        content: payload.content as string | undefined,
        metadata: payload.metadata as Record<string, unknown> | undefined,
        readAt: payload.read_at as string | undefined,
        createdAt: payload.created_at as string,
      };
      setRecentNotifications((prev) => [notification, ...prev].slice(0, 20));
      if (!notification.readAt) {
        setUnreadCount((prev) => prev + 1);
      }
    },
    enabled: enabled && !!userId,
  });

  const initializeUnreadCount = useCallback((count: number) => {
    setUnreadCount(count);
  }, []);

  const markAsRead = useCallback((count: number = 1) => {
    setUnreadCount((prev) => Math.max(0, prev - count));
  }, []);

  const clearAll = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return {
    unreadCount,
    recentNotifications,
    initializeUnreadCount,
    markAsRead,
    clearAll,
  };
}
