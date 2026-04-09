/**
 * Create New Poll Page
 * Simple form to create availability polls in Nextcloud
 */

import { PollCreator } from '@/components/poll-creator';
import { ArrowLeft } from 'lucide-react';
import { Button, Container, Stack, Text, Title } from '@mantine/core';
import Link from 'next/link';

export default function NewPollPage() {
  return (
    <Container size="sm" py="xl">
      <Button
        component={Link}
        href="/polls"
        variant="subtle"
        size="sm"
        leftSection={<ArrowLeft size={16} />}
        mb="md"
      >
        Back to Polls
      </Button>
      <Stack gap="xs" mb="xl">
        <Title order={1}>Create Availability Poll</Title>
        <Text c="dimmed">
          Find the best time for your gathering using Nextcloud Polls
        </Text>
      </Stack>
      <PollCreator />
    </Container>
  );
}
