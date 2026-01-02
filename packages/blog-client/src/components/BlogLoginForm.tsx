'use client';

import { useState, useTransition, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Button,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
  Alert,
} from '@mantine/core';
import { IconShieldLock } from '@tabler/icons-react';
import { signInWithPassword } from '@elkdonis/auth-client';

interface BlogLoginFormProps {
  redirectPath?: string;
  title?: string;
  description?: string;
}

export function BlogLoginForm({
  redirectPath = '/entry',
  title = 'Sign in',
  description = 'Enter your credentials to access the author workspace.',
}: BlogLoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const queryMessage = searchParams?.get('message');

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
      router.replace(redirectPath);
      router.refresh();
    });
  };

  return (
    <Paper withBorder radius="md" p="xl" shadow="sm" maw={420} mx="auto">
      <Stack gap="lg">
        <Stack gap="xs">
          <Title order={2}>{title}</Title>
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        </Stack>

        {queryMessage ? (
          <Alert icon={<IconShieldLock size={16} />} color="yellow" radius="md">
            {queryMessage === 'unauthorized'
              ? 'You need to be an authorized contributor to access that page.'
              : queryMessage}
          </Alert>
        ) : null}

        {error ? (
          <Alert color="red" radius="md">
            {error}
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <TextInput
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              required
            />
            <PasswordInput
              label="Password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
            />
            <Button type="submit" loading={isPending} disabled={isPending}>
              Sign in
            </Button>
          </Stack>
        </form>
      </Stack>
    </Paper>
  );
}
