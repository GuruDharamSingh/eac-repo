'use client';

import { useState, useEffect } from 'react';
import { Container, Title, Text, Tabs, Stack, Paper, Button, Group, Table, Badge, Loader, Center } from '@mantine/core';
import { FileBrowser, TalkRoom } from '@elkdonis/ui';
import { FolderOpen, MessageCircle, Users, Plus, RefreshCw } from 'lucide-react';

interface UserData {
  id: string;
  email: string;
  display_name: string | null;
  nextcloud_synced: boolean;
  nextcloud_user_id: string | null;
}

export default function NextcloudPage() {
  const [activeTab, setActiveTab] = useState('files');
  const orgId = 'elkdonis'; // This would come from user context in production

  // User sync state
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);

  // Mock Talk room data - in production, load from database
  const [talkRooms] = useState([
    { token: 'meeting-1', name: 'Weekly Standup' },
    { token: 'meeting-2', name: 'Project Discussion' },
  ]);

  const [selectedRoom, setSelectedRoom] = useState(talkRooms[0]);

  // Fetch users when Users tab is active
  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    }
  }, [activeTab]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/nextcloud/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/nextcloud/sync-user/${userId}`, {
        method: 'POST',
      });
      if (response.ok) {
        const result = await response.json();
        alert(result.message || 'User synced successfully!');
        loadUsers(); // Reload users after sync
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to sync user');
      }
    } catch (error) {
      console.error('Error syncing user:', error);
      alert('Error syncing user');
    }
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <div>
          <Title order={2}>Nextcloud Integration</Title>
          <Text c="dimmed" size="sm">
            Manage files, collaborate, and communicate with your team
          </Text>
        </div>

        {/* Tabs for different features */}
        <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'files')}>
          <Tabs.List>
            <Tabs.Tab value="files" leftSection={<FolderOpen size={16} />}>
              Files & Folders
            </Tabs.Tab>
            <Tabs.Tab value="talk" leftSection={<MessageCircle size={16} />}>
              Talk & Video
            </Tabs.Tab>
            <Tabs.Tab value="users" leftSection={<Users size={16} />}>
              User Sync
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="files" pt="xl">
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                Browse and manage your organization&apos;s shared files
              </Text>
              <FileBrowser
                orgId={orgId}
                onFileSelect={(file) => {
                  console.log('Selected file:', file);
                }}
              />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="talk" pt="xl">
            <Stack gap="md">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Join video calls and chat with your team
                </Text>
                <Button size="sm" leftSection={<Plus size={16} />}>
                  Create Room
                </Button>
              </Group>

              {/* Room selector */}
              <Paper withBorder p="xs">
                <Group>
                  {talkRooms.map((room) => (
                    <Button
                      key={room.token}
                      variant={selectedRoom.token === room.token ? 'filled' : 'light'}
                      size="xs"
                      onClick={() => setSelectedRoom(room)}
                    >
                      {room.name}
                    </Button>
                  ))}
                </Group>
              </Paper>

              {/* Talk Room */}
              {selectedRoom && (
                <TalkRoom
                  token={selectedRoom.token}
                  roomName={selectedRoom.name}
                  currentUserId="admin-user"
                  height="500px"
                />
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="users" pt="xl">
            <Stack gap="md">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Manage user synchronization with Nextcloud
                </Text>
                <Button
                  size="sm"
                  variant="light"
                  leftSection={<RefreshCw size={16} />}
                  onClick={loadUsers}
                  loading={loading}
                >
                  Refresh
                </Button>
              </Group>

              <Paper withBorder>
                {loading ? (
                  <Center p="xl">
                    <Loader size="sm" />
                  </Center>
                ) : users.length === 0 ? (
                  <Center p="xl">
                    <Text c="dimmed">No users found</Text>
                  </Center>
                ) : (
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Email</Table.Th>
                        <Table.Th>Display Name</Table.Th>
                        <Table.Th>Nextcloud ID</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {users.map((user) => (
                        <Table.Tr key={user.id}>
                          <Table.Td>{user.email}</Table.Td>
                          <Table.Td>{user.display_name || '-'}</Table.Td>
                          <Table.Td>
                            <Text size="xs" c="dimmed" ff="monospace">
                              {user.nextcloud_user_id || '-'}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            {user.nextcloud_synced ? (
                              <Badge color="green" size="sm">Synced</Badge>
                            ) : (
                              <Badge color="gray" size="sm">Not Synced</Badge>
                            )}
                          </Table.Td>
                          <Table.Td>
                            {!user.nextcloud_synced && (
                              <Button
                                size="xs"
                                variant="light"
                                onClick={() => syncUser(user.id)}
                              >
                                Sync
                              </Button>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
              </Paper>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}