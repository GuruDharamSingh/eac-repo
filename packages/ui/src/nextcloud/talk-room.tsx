'use client';

import { useState, useEffect } from 'react';
import { Card, Stack, Group, Text, Button, Badge, TextInput, ScrollArea, ActionIcon } from '@mantine/core';
import { Video, VideoOff, Mic, MicOff, Phone, PhoneOff, Send, Users } from 'lucide-react';

export interface TalkMessage {
  id: number;
  actorDisplayName: string;
  timestamp: number;
  message: string;
  systemMessage: string;
  messageType: string;
}

export interface TalkRoomProps {
  token: string;
  roomName: string;
  currentUserId: string;
  apiEndpoint?: string;
  enableVideo?: boolean;
  enableChat?: boolean;
  height?: string;
  ssoRedirectUrl?: string; // URL to SSO redirect endpoint (e.g., /api/nextcloud/redirect)
}

export function TalkRoom({
  token,
  roomName,
  apiEndpoint = '/api/nextcloud/talk',
  enableVideo = true,
  enableChat = true,
  height = '600px',
  ssoRedirectUrl,
}: TalkRoomProps) {
  const [messages, setMessages] = useState<TalkMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [participants] = useState<string[]>([]);

  // Load messages
  const loadMessages = async () => {
    try {
      const response = await fetch(`${apiEndpoint}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, limit: 50 }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      const response = await fetch(`${apiEndpoint}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, message: newMessage }),
      });

      if (response.ok) {
        setNewMessage('');
        await loadMessages();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  // Toggle call
  const toggleCall = () => {
    setIsInCall(!isInCall);
    if (!isInCall) {
      const nextcloudUrl = typeof window !== 'undefined' && (window as any).ENV?.NEXT_PUBLIC_NEXTCLOUD_URL || 'http://localhost:8080';
      const talkUrl = `${nextcloudUrl}/index.php/call/${token}`;

      if (ssoRedirectUrl) {
        // Use SSO redirect to authenticate before joining
        // This ensures the user is logged into Nextcloud with their app account
        const redirectUrl = `${ssoRedirectUrl}?returnTo=${encodeURIComponent(talkUrl)}`;
        window.open(redirectUrl, '_blank', 'width=800,height=600');
      } else {
        // Fallback: direct link (may result in guest access)
        window.open(talkUrl, '_blank', 'width=800,height=600');
      }
    }
  };

  useEffect(() => {
    if (enableChat) {
      loadMessages();
      // Poll for new messages
      const interval = setInterval(loadMessages, 5000);
      return () => clearInterval(interval);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, enableChat]);

  // Format timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card withBorder radius="md" h={height}>
      <Stack h="100%" gap={0}>
        {/* Header */}
        <Group p="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
          <div style={{ flex: 1 }}>
            <Group gap="xs">
              <Text fw={600}>{roomName}</Text>
              {isInCall && <Badge color="green" size="sm">In Call</Badge>}
            </Group>
            <Group gap="xs" mt={4}>
              <Users size={14} />
              <Text size="xs" c="dimmed">
                {participants.length || 1} participants
              </Text>
            </Group>
          </div>

          {enableVideo && (
            <Group gap="xs">
              <ActionIcon
                variant={isMuted ? 'filled' : 'subtle'}
                onClick={() => setIsMuted(!isMuted)}
                disabled={!isInCall}
              >
                {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
              </ActionIcon>
              <ActionIcon
                variant={!isVideoOn ? 'filled' : 'subtle'}
                onClick={() => setIsVideoOn(!isVideoOn)}
                disabled={!isInCall}
              >
                {isVideoOn ? <Video size={18} /> : <VideoOff size={18} />}
              </ActionIcon>
              <Button
                leftSection={isInCall ? <PhoneOff size={16} /> : <Phone size={16} />}
                color={isInCall ? 'red' : 'blue'}
                onClick={toggleCall}
              >
                {isInCall ? 'Leave Call' : 'Join Call'}
              </Button>
            </Group>
          )}
        </Group>

        {/* Chat Messages */}
        {enableChat && (
          <>
            <ScrollArea style={{ flex: 1 }} p="md">
              <Stack gap="sm">
                {messages.length === 0 ? (
                  <Text ta="center" c="dimmed" py="xl">
                    No messages yet
                  </Text>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id}>
                      {msg.systemMessage ? (
                        <Text ta="center" size="xs" c="dimmed" fs="italic">
                          {msg.message}
                        </Text>
                      ) : (
                        <div>
                          <Group gap="xs">
                            <Text size="sm" fw={600}>
                              {msg.actorDisplayName}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {formatTime(msg.timestamp)}
                            </Text>
                          </Group>
                          <Text size="sm" mt={2}>
                            {msg.message}
                          </Text>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </Stack>
            </ScrollArea>

            {/* Message Input */}
            <Group p="md" gap="xs" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
              <TextInput
                style={{ flex: 1 }}
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={sending}
              />
              <ActionIcon
                size="lg"
                onClick={handleSendMessage}
                disabled={sending || !newMessage.trim()}
              >
                <Send size={18} />
              </ActionIcon>
            </Group>
          </>
        )}
      </Stack>
    </Card>
  );
}