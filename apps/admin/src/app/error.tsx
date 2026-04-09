'use client';

import { Button, Container, Text, Title, Stack } from '@mantine/core';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Admin app error:', error);
  }, [error]);

  return (
    <Container size="sm" py="xl">
      <Stack align="center" gap="md">
        <Title order={2}>Something went wrong</Title>
        <Text c="dimmed" ta="center">
          {error.message || 'An unexpected error occurred'}
        </Text>
        {error.digest && (
          <Text size="xs" c="dimmed">
            Error ID: {error.digest}
          </Text>
        )}
        <Button onClick={reset} variant="light">
          Try again
        </Button>
      </Stack>
    </Container>
  );
}
