'use client';

import {
  Box, Container, Paper, Title, Text, TextInput, PasswordInput,
  Button, Stack, Alert,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useAuthForm } from '@elkdonis/auth-client';

export default function LoginPage() {
  // Shared sign-in logic via the universal auth hook — branding stays local.
  const f = useAuthForm({
    onSuccess: () => {
      window.location.href = '/admin';
    },
  });

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
            <form onSubmit={(e) => void f.submit(e)}>
              <Stack gap="md">
                <Title order={3} ta="center" style={{ fontFamily: "'Cinzel', serif", color: '#36454f', fontSize: '1.1rem' }}>
                  Sign In
                </Title>

                {f.error && (
                  <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                    {f.error}
                  </Alert>
                )}

                <TextInput
                  required
                  label="Email"
                  placeholder="your@email.com"
                  type="email"
                  value={f.email}
                  onChange={(e) => f.setEmail(e.currentTarget.value)}
                  size="md"
                />

                <PasswordInput
                  required
                  label="Password"
                  placeholder="Your password"
                  value={f.password}
                  onChange={(e) => f.setPassword(e.currentTarget.value)}
                  size="md"
                />

                <Button
                  type="submit"
                  fullWidth
                  size="md"
                  loading={f.submitting}
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
