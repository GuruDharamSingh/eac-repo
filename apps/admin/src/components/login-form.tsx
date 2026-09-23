'use client';

import { useState, useTransition, FormEvent } from 'react';
import { Button, Stack, Text, TextInput, PasswordInput, Alert } from '@mantine/core';
import { signInWithPassword } from '@elkdonis/auth-client';

interface LoginFormProps {
  onSuccess: () => void;
  /** Full URL to redirect to after login (e.g. an OAuth authorize URL). Uses a full
   *  page navigation so cookies are sent along with the redirect. */
  returnTo?: string | null;
}

export function LoginForm({ onSuccess, returnTo }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
      if (returnTo) {
        window.location.href = returnTo;
        return;
      }
      onSuccess();
    });
  };

  return (
    <Stack gap="lg">
      {returnTo && (
        <Alert color="blue" radius="md">
          Sign in to continue to Nextcloud
        </Alert>
      )}
      {error && <Alert color="red" radius="md">{error}</Alert>}
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            placeholder="your@email.com"
            required
          />
          <PasswordInput
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            placeholder="Your password"
            required
          />
          <Button type="submit" loading={isPending} disabled={isPending} fullWidth>
            Sign in
          </Button>
        </Stack>
      </form>
      <Text size="xs" c="dimmed" ta="center">
        Sign in to access the Elkdonis Admin dashboard
      </Text>
    </Stack>
  );
}
