/**
 * Create New Poll Page
 * Simple form to create availability polls in Nextcloud
 */

import { PollCreator } from '@/components/poll-creator';
import { ArrowLeft } from 'lucide-react';
import { Box, Button, Container, Stack, Text, Title } from '@mantine/core';
import Link from 'next/link';

export default function NewPollPage() {
  return (
    <Box className="archive-shell">
    <Container size="sm" py="xl" pb={128}>
      <Button
        component={Link}
        href="/polls"
        variant="subtle"
        color="archive"
        size="sm"
        leftSection={<ArrowLeft size={16} />}
        mb="md"
      >
        Back to Polls
      </Button>
      <Stack gap="xs" mb="xl" className="archive-page-header">
        <Text className="archive-kicker">Poll table</Text>
        <Title order={2} className="archive-title">Create Availability Poll</Title>
        <Text className="archive-muted">
          Find the best time for a gathering without losing the thread
        </Text>
      </Stack>
      <PollCreator />
    </Container>
    </Box>
  );
}
