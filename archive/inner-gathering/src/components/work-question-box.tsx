'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Box,
  Button,
  Checkbox,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { MessageSquare, Send } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import { RichTextEditor } from '@elkdonis/ui';

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
  /** Hide the in-box "Current Work Question" eyebrow (e.g. when shown outside the box). */
  hideEyebrow?: boolean;
  /** Hide the scrolling responses ticker at the bottom. */
  hideTicker?: boolean;
  /** Hide the "Posting anonymously" helper note. */
  hideAnonymousNote?: boolean;
  /** Always show a "Go to Forum" link beside the toggles (even for anonymous visitors). */
  showForumLink?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function htmlToText(html: string): string {
  if (!html) return '';
  if (typeof window === 'undefined') return html.replace(/<[^>]*>/g, '').trim();
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').trim();
}

export function WorkQuestionBox({
  userId,
  hideEyebrow = false,
  hideTicker = false,
  hideAnonymousNote = false,
  showForumLink = false,
}: WorkQuestionBoxProps) {
  const [question, setQuestion] = useState<WorkQuestion | null>(null);
  const [responses, setResponses] = useState<ResponseEntry[]>([]);
  const [response, setResponse] = useState('');
  const [signedNameOptIn, setSignedNameOptIn] = useState(false);
  const [signedName, setSignedName] = useState('');
  const [notifyOptIn, setNotifyOptIn] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [passwordOptIn, setPasswordOptIn] = useState(false);
  const [accountPassword, setAccountPassword] = useState('');
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

  const emailValid = !notifyOptIn || EMAIL_RE.test(notifyEmail.trim());
  const wantsAccount = notifyOptIn && passwordOptIn && !userId;
  const passwordValid = !wantsAccount || accountPassword.length >= 6;
  const responseText = htmlToText(response);
  const canSubmit = responseText.length > 0 && emailValid && passwordValid && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      // If the visitor opted to set a password, treat email + password as a
      // lightweight signup before posting so the reply is tied to a real account.
      if (wantsAccount) {
        try {
          const signupRes = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: notifyEmail.trim(),
              password: accountPassword,
              displayName: signedNameOptIn ? signedName.trim() || undefined : undefined,
            }),
          });
          if (signupRes.ok) {
            notifications.show({
              color: 'green',
              title: 'Account created',
              message: 'You can now sign in with this email and password.',
            });
          } else {
            const data = await signupRes.json().catch(() => ({}));
            notifications.show({
              color: 'yellow',
              title: 'Saved your thought',
              message:
                data?.error ??
                'We could not create an account, but your reply was still posted.',
            });
          }
        } catch {
          notifications.show({
            color: 'yellow',
            title: 'Saved your thought',
            message: 'We could not create an account, but your reply was still posted.',
          });
        }
      }

      const res = await fetch('/api/work-question/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          response,
          signedName: signedNameOptIn ? (signedName.trim() || null) : null,
          notifyEmail: notifyOptIn ? notifyEmail.trim() : null,
        }),
      });
      if (!res.ok) throw new Error();
      setSubmitted(true);
      setResponses((prev) => [
        { display_name: signedNameOptIn ? (signedName.trim() || null) : null, response: responseText },
        ...prev,
      ]);
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

  const tickerItems = responses.length > 0 ? [...responses, ...responses] : [];

  const inputStyles = {
    input: {
      background: 'rgba(255, 253, 248, 0.9)',
      border: '1px solid rgba(183, 154, 85, 0.3)',
      borderRadius: 6,
      color: 'var(--ig-ink)',
    },
  };

  return (
    <Box
      style={{
        border: '1px solid rgba(183, 154, 85, 0.55)',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'transparent',
        padding: 'clamp(0.65rem, 2vw, 1.25rem)',
      }}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
          <div style={{ flex: 1, minWidth: 0 }}>
            {!hideEyebrow && (
              <Text
                size="xs"
                fw={700}
                tt="uppercase"
                style={{ letterSpacing: '0.12em', color: 'var(--ig-gold)' }}
              >
                Current Work Question
              </Text>
            )}
            <Title
              order={2}
              mt={hideEyebrow ? 0 : 6}
              style={{
                color: 'var(--ig-ink)',
                lineHeight: 1.15,
                fontWeight: 800,
                fontSize: 'clamp(1.6rem, 4.5vw, 2.4rem)',
                letterSpacing: '0.01em',
              }}
            >
              {question.question}
            </Title>
          </div>
          {!submitted && (
            <Button
              size="sm"
              leftSection={<Send size={14} />}
              loading={saving}
              disabled={!canSubmit}
              onClick={handleSubmit}
              style={{
                background: 'var(--ig-ink)',
                border: '1px solid var(--ig-gold)',
                color: '#fffdf8',
                flexShrink: 0,
              }}
            >
              Share
            </Button>
          )}
        </Group>

        {submitted ? (
          <Text size="sm" fs="italic" style={{ color: 'var(--ig-muted)' }}>
            Your thought has been received. Feel free to return and add more.
          </Text>
        ) : (
          <>
            <Box className="wq-rte">
              <RichTextEditor
                content={response}
                onChange={setResponse}
                placeholder="Write What You Know"
                compact
                minHeight={100}
              />
            </Box>

            <Group className="wq-toggles" gap="lg" wrap="wrap" align="center">
              <Checkbox
                label="Name?"
                checked={signedNameOptIn}
                onChange={(e) => setSignedNameOptIn(e.currentTarget.checked)}
                disabled={saving}
                styles={{ label: { color: 'var(--ig-ink)', fontSize: '0.85rem' } }}
              />
              <Checkbox
                label="Notify on reply?"
                checked={notifyOptIn}
                onChange={(e) => setNotifyOptIn(e.currentTarget.checked)}
                disabled={saving}
                styles={{ label: { color: 'var(--ig-ink)', fontSize: '0.85rem' } }}
              />
              {(userId || showForumLink) && (
                <Link
                  href="/forum"
                  className="wq-forum-link"
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
                  {showForumLink && !userId ? 'Go to Forum' : 'Join the conversation on our Forum'}
                </Link>
              )}
            </Group>

            {signedNameOptIn && (
              <TextInput
                placeholder="Sign your name"
                value={signedName}
                onChange={(e) => setSignedName(e.currentTarget.value)}
                disabled={saving}
                maxLength={120}
                styles={inputStyles}
              />
            )}

            {notifyOptIn && (
              <Stack gap="xs">
                <Group gap="sm" wrap="wrap" align="center">
                  <TextInput
                    type="email"
                    placeholder={userId ? 'Email for replies' : 'Your email address'}
                    value={notifyEmail}
                    onChange={(e) => setNotifyEmail(e.currentTarget.value)}
                    disabled={saving}
                    required
                    error={
                      notifyEmail.trim() && !EMAIL_RE.test(notifyEmail.trim())
                        ? 'Enter a valid email'
                        : null
                    }
                    styles={inputStyles}
                    style={{ flex: 1, minWidth: 200 }}
                  />
                  {!userId && (
                    <Checkbox
                      label="Add account password?"
                      checked={passwordOptIn}
                      onChange={(e) => setPasswordOptIn(e.currentTarget.checked)}
                      disabled={saving}
                      styles={{ label: { color: 'var(--ig-ink)', fontSize: '0.85rem' } }}
                    />
                  )}
                </Group>
                {wantsAccount && (
                  <TextInput
                    type="password"
                    placeholder="Choose a password (min. 6 characters)"
                    value={accountPassword}
                    onChange={(e) => setAccountPassword(e.currentTarget.value)}
                    disabled={saving}
                    error={
                      accountPassword && accountPassword.length < 6
                        ? 'At least 6 characters'
                        : null
                    }
                    styles={inputStyles}
                  />
                )}
                {wantsAccount && (
                  <Text size="xs" fs="italic" style={{ color: 'var(--ig-muted)' }}>
                    Your email and password become your account — sign in anytime to follow replies.
                  </Text>
                )}
              </Stack>
            )}

            {!userId && !hideAnonymousNote && (
              <Text size="xs" fs="italic" style={{ color: 'var(--ig-muted)' }}>
                Posting anonymously.{' '}
                <Link href="/login" style={{ color: 'var(--ig-gold, #8f763c)' }}>
                  Sign in
                </Link>{' '}
                to post under your account.
              </Text>
            )}
          </>
        )}
      </Stack>

      {/* Responses ticker */}
      {!hideTicker && tickerItems.length > 0 && (
        <Box
          style={{
            borderTop: '1px solid rgba(183,154,85,0.25)',
            overflow: 'hidden',
            padding: '0.5rem 0',
            marginTop: '1rem',
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
                    {htmlToText(item.response)}
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

