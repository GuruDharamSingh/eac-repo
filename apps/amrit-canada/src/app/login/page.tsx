'use client';

import { useState } from 'react';
import {
  Box, Container, Paper, Title, Text, TextInput, PasswordInput,
  Button, Stack, Alert,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { signInWithPassword } from '@elkdonis/auth-client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { user, error: signInError } = await signInWithPassword(email, password);
      if (signInError) throw new Error(signInError);
      if (user) {
        window.location.href = '/admin';
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      style={{
        minHeight: '80vh',
        background: 'linear-gradient(160deg, #36454f 0%, #2c3840 100%)',
        display: 'flex',
        alignItems: 'center',
        padding: '2rem 1rem',
      }}
    >
      <Container size={400}>
        <Stack gap="xl">
          <Stack align="center" gap="xs">
            <Title
              order={2}
              style={{
                color: '#f4c430',
                fontFamily: "'Cinzel', serif",
                textAlign: 'center',
                textShadow: '0 1px 6px rgba(0,0,0,0.4)',
              }}
            >
              Amrit Vela Toronto
            </Title>
            <Text size="sm" style={{ color: '#fdf5e6', opacity: 0.7, textAlign: 'center' }}>
              Admin access
            </Text>
          </Stack>

          <Paper
            p="xl"
            radius="md"
            style={{
              background: 'linear-gradient(135deg, #fffde7 0%, #fdf5e6 100%)',
              border: '1px solid rgba(244,196,48,0.5)',
            }}
          >
            <form onSubmit={handleSubmit}>
              <Stack gap="md">
                <Title order={3} ta="center" style={{ fontFamily: "'Cinzel', serif", color: '#36454f', fontSize: '1.1rem' }}>
                  Sign In
                </Title>

                {error && (
                  <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                    {error}
                  </Alert>
                )}

                <TextInput
                  required
                  label="Email"
                  placeholder="your@email.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                  size="md"
                />

                <PasswordInput
                  required
                  label="Password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  size="md"
                />

                <Button
                  type="submit"
                  fullWidth
                  size="md"
                  loading={loading}
                  style={{
                    background: 'linear-gradient(90deg, #f4c430, #e67e50)',
                    color: '#36454f',
                    fontWeight: 700,
                    border: 'none',
                  }}
                >
                  Sign In
                </Button>
              </Stack>
            </form>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
