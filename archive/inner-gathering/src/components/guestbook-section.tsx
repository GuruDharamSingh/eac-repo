'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Collapse,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
  UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { BookOpen, ChevronDown, Send, X } from 'lucide-react';

interface GuestbookEntry {
  id: string;
  display_name: string | null;
  message: string;
  created_at: string;
}

interface GuestbookSectionProps {
  userId: string | null;
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function GuestbookSection({ userId }: GuestbookSectionProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/guestbook');
      const data = await res.json();
      if (data.entries) setEntries(data.entries);
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const handleSubmit = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setMessage('');
      setEntries((prev) => [data.entry, ...prev]);
      setOpen(true);
      notifications.show({ color: 'green', message: 'Left in the book.' });
    } catch (err) {
      notifications.show({ color: 'red', message: err instanceof Error ? err.message : 'Please try again.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Box
      style={{
        border: '1px solid rgba(183,154,85,0.4)',
        borderRadius: 8,
        background: 'linear-gradient(135deg, rgba(255,253,248,0.82) 0%, rgba(243,234,220,0.6) 100%)',
        overflow: 'hidden',
      }}
    >
      <Stack gap={0}>
        {/* Header */}
        <Group gap="sm" p="md" pb="xs">
          <BookOpen size={16} color="var(--ig-gold, #b79a55)" />
          <Box style={{ flex: 1 }}>
            <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: '0.12em', color: 'var(--ig-gold, #b79a55)' }}>
              Gathering Book
            </Text>
            <Text size="xs" fs="italic" style={{ color: 'var(--ig-muted, #063179)' }}>
              Leave a note for the collective
            </Text>
          </Box>
          {message && (
            <ActionIcon variant="subtle" size="sm" onClick={() => setMessage('')} aria-label="Clear">
              <X size={14} />
            </ActionIcon>
          )}
        </Group>

        {/* Input */}
        <Box px="md" pb="sm">
          <Textarea
            placeholder={userId ? 'Write a short note...' : 'Sign in to leave a note'}
            minRows={2}
            maxRows={5}
            autosize
            value={message}
            onChange={(e) => setMessage(e.currentTarget.value)}
            disabled={!userId || sending}
            styles={{
              input: {
                background: 'rgba(255,253,248,0.9)',
                border: '1px solid rgba(183,154,85,0.28)',
                borderRadius: 6,
                color: 'var(--ig-ink, #01124E)',
              },
            }}
          />
          {userId && (
            <Group justify="flex-end" mt="xs">
              <Button
                size="xs"
                leftSection={<Send size={13} />}
                loading={sending}
                disabled={!message.trim()}
                onClick={handleSubmit}
                style={{ background: 'var(--ig-ink, #01124E)', borderColor: 'rgba(183,154,85,0.5)', color: '#fffdf8' }}
              >
                Leave note
              </Button>
            </Group>
          )}
        </Box>

        {/* Expandable entries */}
        {loaded && entries.length > 0 && (
          <>
            <UnstyledButton
              onClick={() => setOpen((o) => !o)}
              px="md"
              py="xs"
              style={{ borderTop: '1px solid rgba(183,154,85,0.18)' }}
            >
              <Group gap={6}>
                <ChevronDown
                  size={13}
                  style={{
                    transition: 'transform 180ms',
                    transform: open ? 'rotate(180deg)' : 'none',
                    color: 'var(--ig-muted, #063179)',
                  }}
                />
                <Text size="xs" c="dimmed" fs="italic">
                  {entries.length} note{entries.length !== 1 ? 's' : ''} in the book
                </Text>
              </Group>
            </UnstyledButton>

            <Collapse in={open}>
              <Stack gap={0}>
                {entries.map((e, i) => (
                  <Paper
                    key={e.id}
                    radius={0}
                    px="md"
                    py="sm"
                    style={{
                      borderTop: i === 0 ? 'none' : '1px solid rgba(183,154,85,0.12)',
                      background: i % 2 === 0 ? 'rgba(255,253,248,0.4)' : 'transparent',
                    }}
                  >
                    <Group justify="space-between" mb={4} wrap="nowrap">
                      <Text size="xs" fw={600} style={{ color: 'var(--ig-ink, #01124E)' }}>
                        {e.display_name ?? 'A member'}
                      </Text>
                      <Text size="xs" c="dimmed">{relativeTime(e.created_at)}</Text>
                    </Group>
                    <Text size="sm" style={{ color: 'var(--ig-ink, #01124E)', lineHeight: 1.55 }}>
                      {e.message}
                    </Text>
                  </Paper>
                ))}
              </Stack>
            </Collapse>
          </>
        )}
      </Stack>
    </Box>
  );
}
