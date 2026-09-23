'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Container, Paper, Stack, Text, Title } from '@mantine/core';
import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get returnTo parameter - this is the OAuth authorize URL to redirect back to
  const returnTo = searchParams?.get('returnTo');

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
          <LoginForm
            returnTo={returnTo}
            onSuccess={() => {
              router.replace('/');
              router.refresh();
            }}
          />
        </Paper>
      </Stack>
    </Container>
  );
}
