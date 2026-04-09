/**
 * Polls List Page
 * Uses custom UI with Nextcloud Polls API backend (hybrid approach)
 */

import { PollsList } from '@/components/polls-list';
import { Calendar, Plus } from 'lucide-react';
import { Button, Container, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import Link from 'next/link';

export default function PollsPage() {
  return (
    <Container size="xl" py="xl" pb={128}>
      {/* Header */}
      <Group justify="space-between" mb="lg">
        <Stack gap={4}>
          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="indigo">
              <Calendar size={24} />
            </ThemeIcon>
            <Title order={1}>Availability Polls</Title>
          </Group>
          <Text c="dimmed">
            Find the best time for your next gathering
          </Text>
        </Stack>
        <Button component={Link} href="/polls/new" leftSection={<Plus size={16} />}>
          Create Poll
        </Button>
      </Group>

      {/* Polls List - Custom UI using Nextcloud API */}
      <PollsList />
    </Container>
  );
}
