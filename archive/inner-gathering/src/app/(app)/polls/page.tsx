/**
 * Polls List Page
 * Uses custom UI with Nextcloud Polls API backend (hybrid approach)
 */

import { PollsList } from '@/components/polls-list';
import { Calendar, Plus } from 'lucide-react';
import { Box, Button, Container, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import Link from 'next/link';

export default function PollsPage() {
  return (
    <Box className="archive-shell">
    <Container size="xl" py="xl" pb={128}>
      {/* Header */}
      <Group justify="space-between" mb="lg" className="archive-page-header" wrap="wrap">
        <Stack gap={4}>
          <Group gap="sm">
            <ThemeIcon size="lg" radius="sm" variant="light" color="archive">
              <Calendar size={24} />
            </ThemeIcon>
            <Title order={2} className="archive-title">Poll Table</Title>
          </Group>
          <Text className="archive-muted">
            Ask the room, gather availability, and settle meeting times
          </Text>
        </Stack>
        <Button component={Link} href="/polls/new" color="archive" leftSection={<Plus size={16} />}>
          Create Poll
        </Button>
      </Group>

      {/* Polls List - Custom UI using Nextcloud API */}
      <PollsList />
    </Container>
    </Box>
  );
}
