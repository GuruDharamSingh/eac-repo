import { Events } from '@elkdonis/db/events';
import { Container, Stack, Title, Text, Paper, Group, Badge, Select, Table, ActionIcon, Tooltip } from '@mantine/core';
import { Activity, Filter, Eye, EyeOff, Lock, Unlock, Pin, PinOff } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

/**
 * Admin Events Page - Network Activity Log & Moderation
 *
 * Displays all activity across the network with filtering and moderation controls.
 * Admins have full veto power over content visibility and can take action directly.
 */

export default async function EventsPage({
  searchParams
}: {
  searchParams: { action?: string; type?: string; org?: string }
}) {
  const { action, type, org } = searchParams;

  // Fetch events with filters
  const events = await Events.getAllEvents({
    limit: 100,
    action: action as any,
    resourceType: type as any,
    orgId: org
  });

  // Fetch stats for dashboard
  const stats = await Events.getEventStats();

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Group gap="sm">
              <Paper radius="md" withBorder px="xs" py={4}>
                <Activity className="h-5 w-5" />
              </Paper>
              <div>
                <Title order={2}>Network Activity Log</Title>
                <Text size="sm" c="dimmed">
                  Monitor all activity and moderate content across the network
                </Text>
              </div>
            </Group>
          </Stack>
        </Group>

        {/* Stats Cards */}
        <Group grow>
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Posts</Text>
            <Text size="xl" fw={700}>{stats.post_events || 0}</Text>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Meetings</Text>
            <Text size="xl" fw={700}>{stats.meeting_events || 0}</Text>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Replies</Text>
            <Text size="xl" fw={700}>{stats.reply_events || 0}</Text>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Moderation</Text>
            <Text size="xl" fw={700}>{stats.moderation_events || 0}</Text>
          </Paper>
        </Group>

        {/* Filters */}
        <Paper withBorder p="md" radius="md">
          <Group>
            <Filter className="h-4 w-4" />
            <Text size="sm" fw={600}>Filters</Text>
            <Select
              placeholder="Action type"
              data={[
                { value: 'post_created', label: 'Post Created' },
                { value: 'post_published', label: 'Post Published' },
                { value: 'meeting_created', label: 'Meeting Created' },
                { value: 'meeting_published', label: 'Meeting Published' },
                { value: 'reply_created', label: 'Reply Created' },
                { value: 'content_hidden', label: 'Content Hidden' },
                { value: 'visibility_override', label: 'Visibility Override' }
              ]}
              clearable
              w={200}
            />
            <Select
              placeholder="Resource type"
              data={[
                { value: 'post', label: 'Posts' },
                { value: 'meeting', label: 'Meetings' },
                { value: 'reply', label: 'Replies' },
                { value: 'user', label: 'Users' }
              ]}
              clearable
              w={200}
            />
          </Group>
        </Paper>

        {/* Events Table */}
        <Paper withBorder radius="md">
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Time</Table.Th>
                <Table.Th>User</Table.Th>
                <Table.Th>Action</Table.Th>
                <Table.Th>Resource</Table.Th>
                <Table.Th>Organization</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {events.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6} ta="center" py="xl">
                    <Activity className="mx-auto mb-3 h-12 w-12 text-gray-400" />
                    <Text c="dimmed">No events found</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                events.map((event: any) => (
                  <Table.Tr key={event.id}>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {dayjs(event.created_at).fromNow()}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <div>
                          <Text size="sm" fw={500}>
                            {event.user_name || 'Unknown'}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {event.user_email}
                          </Text>
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        variant="light"
                        color={
                          event.action.includes('created') ? 'blue' :
                          event.action.includes('published') ? 'green' :
                          event.action.includes('deleted') ? 'red' :
                          event.action.includes('hidden') ? 'orange' :
                          'gray'
                        }
                      >
                        {event.action}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Badge variant="outline" size="sm">
                          {event.resource_type}
                        </Badge>
                        <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
                          {event.resource_id.substring(0, 8)}...
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{event.org_name || '-'}</Text>
                    </Table.Td>
                    <Table.Td>
                      {(event.resource_type === 'post' || event.resource_type === 'meeting') && (
                        <Group gap="xs">
                          <Tooltip label="Hide from forum">
                            <ActionIcon variant="subtle" color="orange" size="sm">
                              <EyeOff className="h-4 w-4" />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Pin to forum">
                            <ActionIcon variant="subtle" color="blue" size="sm">
                              <Pin className="h-4 w-4" />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Lock thread">
                            <ActionIcon variant="subtle" color="gray" size="sm">
                              <Lock className="h-4 w-4" />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Paper>

        {/* Help Text */}
        <Paper withBorder p="md" radius="md" bg="blue.0">
          <Text size="sm" c="dimmed">
            <strong>Admin Powers:</strong> You have full veto power over all content. Use the action buttons to hide content from forum, pin important threads, or lock discussions. All actions are logged in this activity feed.
          </Text>
        </Paper>
      </Stack>
    </Container>
  );
}
