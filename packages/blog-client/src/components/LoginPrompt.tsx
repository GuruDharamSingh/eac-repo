'use client';

import Link from 'next/link';
import { Paper, Stack, Title, Text, Button, Center, ThemeIcon } from '@mantine/core';
import { IconLogin } from '@tabler/icons-react';

interface LoginPromptProps {
  title?: string;
  description?: string;
  loginHref?: string;
  returnTo?: string;
}

export function LoginPrompt({
  title = 'Sign in required',
  description = 'You need to sign in to access this page.',
  loginHref = '/login',
  returnTo,
}: LoginPromptProps) {
  const href = returnTo ? `${loginHref}?returnTo=${encodeURIComponent(returnTo)}` : loginHref;

  return (
    <Center py="xl">
      <Paper withBorder radius="lg" p="xl" shadow="sm" maw={400} w="100%">
        <Stack gap="md" align="center">
          <ThemeIcon size={64} radius="xl" variant="light" color="blue">
            <IconLogin size={32} />
          </ThemeIcon>
          <Title order={3} ta="center">
            {title}
          </Title>
          <Text size="sm" c="dimmed" ta="center">
            {description}
          </Text>
          <Button component={Link} href={href} fullWidth mt="sm">
            Sign In
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}
