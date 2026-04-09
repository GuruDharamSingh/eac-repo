import { useEffect, useRef, useState, useCallback } from 'react';
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

interface PresenceUser {
  userId: string;
  displayName?: string;
  avatarUrl?: string;
  onlineAt: string;
}

interface UsePresenceOptions {
  client: SupabaseClient;
  channelName: string;
  user: {
    userId: string;
    displayName?: string;
    avatarUrl?: string;
  };
  enabled?: boolean;
}

export function usePresence({
  client,
  channelName,
  user,
  enabled = true,
}: UsePresenceOptions) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled || !user.userId) return;

    const channel = client.channel(`presence:${channelName}`, {
      config: { presence: { key: user.userId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceUser>();
        const users: PresenceUser[] = [];
        for (const presences of Object.values(state)) {
          if (presences.length > 0) {
            users.push(presences[0] as unknown as PresenceUser);
          }
        }
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: user.userId,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            onlineAt: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [client, channelName, user.userId, user.displayName, user.avatarUrl, enabled]);

  const onlineCount = onlineUsers.length;

  const isUserOnline = useCallback(
    (userId: string) => onlineUsers.some((u) => u.userId === userId),
    [onlineUsers]
  );

  return {
    onlineUsers,
    onlineCount,
    isUserOnline,
  };
}
