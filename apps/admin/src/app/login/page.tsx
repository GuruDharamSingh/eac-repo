'use client';

import { useState, useTransition, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Button,
  Container,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
  Alert,
} from '@mantine/core';
import { signInWithPassword } from '@elkdonis/auth-client';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Get returnTo parameter - this is the OAuth authorize URL to redirect back to
  const returnTo = searchParams?.get('returnTo');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    startTransition(async () => {
      const { error: signInError } = await signInWithPassword(email, password);

      if (signInError) {
        setError(signInError);
        return;
      }

      setEmail('');
      setPassword('');

      // If returnTo exists (from OAuth flow), redirect back to continue the OAuth flow
      if (returnTo) {
        // Use window.location for full page redirect to ensure cookies are sent
        window.location.href = returnTo;
      } else {
        // Default redirect to admin dashboard
        router.replace('/');
        router.refresh();
      }
    });
  };

  return (
    <Container size="xs" py="xl">
      <Stack gap="xl" align="center">
        <Stack gap="xs" align="center">
          <Title order={1}>Elkdonis Admin</Title>
          <Text size="sm" c="dimmed">
            Sign in to access the admin dashboard
          </Text>
        </Stack>

        <Paper withBorder radius="md" p="xl" shadow="sm" w="100%">
          <Stack gap="lg">
            {returnTo && (
              <Alert color="blue" radius="md">
                Sign in to continue to Nextcloud
              </Alert>
            )}

            {error && (
              <Alert color="red" radius="md">
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <Stack gap="md">
                <TextInput
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  placeholder="your@email.com"
                  required
                />
                <PasswordInput
                  label="Password"
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  placeholder="Your password"
                  required
                />
                <Button type="submit" loading={isPending} disabled={isPending} fullWidth>
                  Sign in
                </Button>
              </Stack>
            </form>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
