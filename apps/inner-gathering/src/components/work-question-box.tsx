'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Box, Button, Group, Stack, Text, Textarea, Title } from '@mantine/core';
import { MessageSquare, Send } from 'lucide-react';
import { notifications } from '@mantine/notifications';

interface WorkQuestion {
  id: string;
  question: string;
}

interface ResponseEntry {
  display_name: string | null;
  response: string;
}

interface WorkQuestionBoxProps {
  userId?: string | null;
}

export function WorkQuestionBox({ userId }: WorkQuestionBoxProps) {
  const [question, setQuestion] = useState<WorkQuestion | null>(null);
  const [responses, setResponses] = useState<ResponseEntry[]>([]);
  const [response, setResponse] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/work-question?responses=1')
      .then((r) => r.json())
      .then((data) => {
        if (data.question) setQuestion(data.question);
        if (data.responses) setResponses(data.responses);
      })
      .catch(() => {});
  }, []);

  if (!question) return null;

  const handleSubmit = async () => {
    if (!response.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/work-question/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id, response }),
      });
      if (!res.ok) throw new Error();
      setSubmitted(true);
      // Add the new response to the ticker immediately
      setResponses((prev) => [{ display_name: null, response: response.trim() }, ...prev]);
      setResponse('');
      notifications.show({
        color: 'green',
        title: 'Thought received',
        message: 'Thank you for sharing.',
      });
    } catch {
      notifications.show({
        color: 'red',
        title: 'Could not save',
        message: 'Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Duplicate responses for seamless infinite scroll
  const tickerItems = responses.length > 0 ? [...responses, ...responses] : [];

  return (
    <Box
      style={{
        border: '1px solid rgba(183, 154, 85, 0.55)',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'transparent',
        padding: 'clamp(1rem, 3vw, 1.5rem)',
      }}
    >
      <Stack gap="sm">
        <div>
          <Text
            size="xs"
            fw={700}
            tt="uppercase"
            style={{ letterSpacing: '0.12em', color: 'var(--ig-gold)' }}
          >
            Current Work Question
          </Text>
          <Title order={4} mt={4} style={{ color: 'var(--ig-ink)', lineHeight: 1.3 }}>
            {question.question}
          </Title>
        </div>

        {submitted ? (
          <Text size="sm" fs="italic" style={{ color: 'var(--ig-muted)' }}>
            Your thought has been received. Feel free to return and add more.
          </Text>
        ) : (
          <>
            <Textarea
              placeholder="Please feel inspired to write your thoughts...."
              minRows={3}
              maxRows={8}
              autosize
              value={response}
              onChange={(e) => setResponse(e.currentTarget.value)}
              disabled={!userId || saving}
              styles={{
                input: {
                  background: 'rgba(255, 253, 248, 0.9)',
                  border: '1px solid rgba(183, 154, 85, 0.3)',
                  borderRadius: 6,
                  color: 'var(--ig-ink)',
                  fontStyle: response ? 'normal' : 'italic',
                },
              }}
            />
            {!userId && (
              <Text size="xs" fs="italic" style={{ color: 'var(--ig-muted)' }}>
                Sign in to share your thoughts.
              </Text>
            )}
            {userId && (
              <Group justify="space-between" align="center" wrap="wrap">
                <Link
                  href="/forum"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'var(--ig-gold, #8f763c)',
                    textDecoration: 'none',
                    borderBottom: '1px solid transparent',
                    paddingBottom: 2,
                    transition: 'border-color 0.18s ease, color 0.18s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.borderBottomColor = 'rgba(183,154,85,0.7)';
                    (e.currentTarget as HTMLAnchorElement).style.color = 'var(--ig-ink, #01124E)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.borderBottomColor = 'transparent';
                    (e.currentTarget as HTMLAnchorElement).style.color = 'var(--ig-gold, #8f763c)';
                  }}
                >
                  <MessageSquare size={13} />
                  Join the conversation on our Forum
                </Link>
                <Button
                  size="sm"
                  leftSection={<Send size={14} />}
                  loading={saving}
                  disabled={!response.trim()}
                  onClick={handleSubmit}
                  style={{
                    background: 'var(--ig-ink)',
                    border: '1px solid var(--ig-gold)',
                    color: '#fffdf8',
                  }}
                >
                  Share
                </Button>
              </Group>
            )}
          </>
        )}
      </Stack>

      {/* Responses ticker */}
      {tickerItems.length > 0 && (
        <Box
          style={{
            borderTop: '1px solid rgba(183,154,85,0.25)',
            overflow: 'hidden',
            padding: '0.5rem 0',
          }}
        >
          <div
            aria-label="Collective responses"
            style={{ display: 'flex', overflow: 'hidden', position: 'relative' }}
          >
            <div className="wq-ticker-track">
              {tickerItems.map((item, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--ig-ink, #01124E)',
                    opacity: 0.72,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ color: 'var(--ig-gold, #b79a55)', fontWeight: 600 }}>
                    {item.display_name ?? '—'}
                  </span>
                  <span style={{ fontStyle: 'italic', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.response}
                  </span>
                  <span style={{ opacity: 0.3, marginLeft: '0.5rem' }}>·</span>
                </span>
              ))}
            </div>
          </div>
        </Box>
      )}
    </Box>
  );
}
