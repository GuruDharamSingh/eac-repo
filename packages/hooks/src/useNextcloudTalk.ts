import { useState, useEffect, useCallback } from 'react';
import { POLL_INTERVAL, NEXTCLOUD_DEFAULT_URL } from '@elkdonis/utils';

export interface TalkMessage {
  id: number;
  actorDisplayName: string;
  timestamp: number;
  message: string;
  systemMessage: string;
  messageType: string;
}

interface UseNextcloudTalkOptions {
  token: string;
  apiEndpoint?: string;
  enableChat?: boolean;
  enablePolling?: boolean;
  pollInterval?: number;
}

export function useNextcloudTalk({
  token,
  apiEndpoint = '/api/nextcloud/talk',
  enableChat = true,
  enablePolling = true,
  pollInterval = POLL_INTERVAL,
}: UseNextcloudTalkOptions) {
  const [messages, setMessages] = useState<TalkMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!enableChat) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiEndpoint}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, limit: 50 }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      } else {
        throw new Error('Failed to load messages');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
      console.error('Error loading messages:', err);
    } finally {
      setLoading(false);
    }
  }, [token, apiEndpoint, enableChat]);

  // Send message
  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim()) return;

    setSending(true);
    setError(null);

    try {
      const response = await fetch(`${apiEndpoint}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, message }),
      });

      if (response.ok) {
        await loadMessages();
        return true;
      } else {
        throw new Error('Failed to send message');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      console.error('Error sending message:', err);
      return false;
    } finally {
      setSending(false);
    }
  }, [token, apiEndpoint, loadMessages]);

  // Toggle call
  const toggleCall = useCallback(() => {
    setIsInCall(!isInCall);
    if (!isInCall) {
      // Open Nextcloud Talk in new window
      const nextcloudUrl = typeof window !== 'undefined'
        ? (window as any).ENV?.NEXT_PUBLIC_NEXTCLOUD_URL || NEXTCLOUD_DEFAULT_URL
        : NEXTCLOUD_DEFAULT_URL;
      const talkUrl = `${nextcloudUrl}/index.php/call/${token}`;
      window.open(talkUrl, '_blank', 'width=800,height=600');
    }
  }, [isInCall, token]);

  // Polling effect
  useEffect(() => {
    if (enableChat && enablePolling) {
      loadMessages();
      const interval = setInterval(loadMessages, pollInterval);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [token, enableChat, enablePolling, pollInterval, loadMessages]);

  return {
    messages,
    loading,
    sending,
    error,
    isInCall,
    isMuted,
    isVideoOn,
    setIsMuted,
    setIsVideoOn,
    sendMessage,
    loadMessages,
    toggleCall,
  };
}