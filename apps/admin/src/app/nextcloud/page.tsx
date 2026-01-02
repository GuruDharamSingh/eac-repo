'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Text,
  Tabs,
  Stack,
  Paper,
  Button,
  Group,
  Badge,
  Loader,
  Center,
  Select,
  Grid,
  ScrollArea,
  Avatar,
  ActionIcon,
  Tooltip,
  Divider,
  Box,
} from '@mantine/core';
import { FileBrowser, TalkRoom } from '@elkdonis/ui';
import {
  FolderOpen,
  MessageCircle,
  Users,
  Plus,
  RefreshCw,
  Shield,
  ArrowRight,
  Check,
  X,
} from 'lucide-react';

interface AppUser {
  id: string;
  email: string;
  display_name: string | null;
  is_admin: boolean;
  nextcloud_synced: boolean;
  nextcloud_user_id: string | null;
  created_at: string;
  role?: string;
  organizations?: string[];
}

interface NextcloudUser {
  id: string;
  displayName: string;
  email: string;
  enabled: boolean;
  groups: string[];
  lastLogin: number;
}

const ORGANIZATIONS = [
  { value: 'all', label: 'All Users' },
  { value: 'inner_group', label: 'InnerGathering' },
  { value: 'sunjay', label: "Sunjay's Teaching Circle" },
  { value: 'guru-dharam', label: "Guru Dharam's Practice" },
  { value: 'elkdonis', label: 'Elkdonis Arts Collective' },
];

export default function NextcloudPage() {
  const [activeTab, setActiveTab] = useState('files');
  const orgId = 'elkdonis';

  // User sync state
  const [selectedOrg, setSelectedOrg] = useState<string>('inner_group');
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [nextcloudUsers, setNextcloudUsers] = useState<NextcloudUser[]>([]);
  const [loadingApp, setLoadingApp] = useState(false);
  const [loadingNc, setLoadingNc] = useState(false);
  const [syncingUsers, setSyncingUsers] = useState<Set<string>>(new Set());
  const [togglingAdmin, setTogglingAdmin] = useState<Set<string>>(new Set());

  // Talk room state
  const [talkRooms] = useState([
    { token: 'meeting-1', name: 'Weekly Standup' },
    { token: 'meeting-2', name: 'Project Discussion' },
  ]);
  const [selectedRoom, setSelectedRoom] = useState(talkRooms[0]);

  // Load users when tab or org changes
  useEffect(() => {
    if (activeTab === 'users') {
      loadAppUsers();
      loadNextcloudUsers();
    }
  }, [activeTab, selectedOrg]);

  const loadAppUsers = async () => {
    setLoadingApp(true);
    try {
      const response = await fetch(`/api/users/by-org?org=${selectedOrg}`);
      if (response.ok) {
        const data = await response.json();
        setAppUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error loading app users:', error);
    } finally {
      setLoadingApp(false);
    }
  };

  const loadNextcloudUsers = async () => {
    setLoadingNc(true);
    try {
      const response = await fetch('/api/nextcloud/nc-users');
      if (response.ok) {
        const data = await response.json();
        setNextcloudUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error loading Nextcloud users:', error);
    } finally {
      setLoadingNc(false);
    }
  };

  const syncUser = async (userId: string) => {
    setSyncingUsers(prev => new Set(prev).add(userId));
    try {
      const response = await fetch(`/api/nextcloud/sync-user/${userId}`, {
        method: 'POST',
      });
      if (response.ok) {
        loadAppUsers();
        loadNextcloudUsers();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to sync user');
      }
    } catch (error) {
      console.error('Error syncing user:', error);
    } finally {
      setSyncingUsers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const toggleAdmin = async (userId: string, currentIsAdmin: boolean) => {
    setTogglingAdmin(prev => new Set(prev).add(userId));
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdmin: !currentIsAdmin }),
      });
      if (response.ok) {
        loadAppUsers();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update admin status');
      }
    } catch (error) {
      console.error('Error toggling admin:', error);
    } finally {
      setTogglingAdmin(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  // Filter users
  const syncedUsers = appUsers.filter(u => u.nextcloud_synced);
  const unsyncedUsers = appUsers.filter(u => !u.nextcloud_synced);

  // Check if NC user exists in app
  const getMatchingAppUser = (ncUserId: string) => {
    return appUsers.find(u => u.nextcloud_user_id === ncUserId || u.id === ncUserId);
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <div>
          <Title order={2}>Nextcloud Integration</Title>
          <Text c="dimmed" size="sm">
            Manage files, collaborate, and communicate with your team
          </Text>
        </div>

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
                onFileSelect={(file) => console.log('Selected file:', file)}
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
              {/* Header */}
              <Group justify="space-between">
                <Group>
                  <Select
                    value={selectedOrg}
                    onChange={(value) => setSelectedOrg(value || 'all')}
                    data={ORGANIZATIONS}
                    size="sm"
                    w={200}
                    styles={{
                      input: {
                        backgroundColor: '#fff',
                        color: '#212529',
                        fontWeight: 500,
                      },
                      dropdown: {
                        backgroundColor: '#fff',
                      },
                      option: {
                        color: '#212529',
                        fontWeight: 500,
                      },
                    }}
                  />
                  <Text size="sm" c="dimmed">
                    {appUsers.length} users
                  </Text>
                </Group>
                <Group>
                  <Button
                    size="sm"
                    variant="light"
                    leftSection={<RefreshCw size={16} />}
                    onClick={() => {
                      loadAppUsers();
                      loadNextcloudUsers();
                    }}
                    loading={loadingApp || loadingNc}
                  >
                    Refresh
                  </Button>
                </Group>
              </Group>

              {/* Three Column Layout */}
              <Grid gutter="md">
                {/* LEFT: App Users (not synced) */}
                <Grid.Col span={4}>
                  <Paper withBorder p="md" h={500}>
                    <Stack gap="sm" h="100%">
                      <Group justify="space-between">
                        <Text fw={600} size="sm">App Users</Text>
                        <Badge size="sm" color="gray">{unsyncedUsers.length} pending</Badge>
                      </Group>
                      <Text size="xs" c="dimmed">Users without Nextcloud access</Text>
                      <Divider />
                      <ScrollArea h={400} offsetScrollbars>
                        {loadingApp ? (
                          <Center h={100}><Loader size="sm" /></Center>
                        ) : unsyncedUsers.length === 0 ? (
                          <Center h={100}>
                            <Stack align="center" gap="xs">
                              <Check size={24} color="green" />
                              <Text size="sm" c="dimmed">All users synced!</Text>
                            </Stack>
                          </Center>
                        ) : (
                          <Stack gap="xs">
                            {unsyncedUsers.map((user) => (
                              <Paper key={user.id} withBorder p="xs" radius="sm">
                                <Group justify="space-between" wrap="nowrap">
                                  <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                                    <Avatar size="sm" color="gray" radius="xl">
                                      {(user.display_name || user.email)[0].toUpperCase()}
                                    </Avatar>
                                    <Box style={{ minWidth: 0 }}>
                                      <Text size="xs" fw={500} truncate>
                                        {user.display_name || user.email.split('@')[0]}
                                      </Text>
                                      <Text size="xs" c="dimmed" truncate>
                                        {user.email}
                                      </Text>
                                    </Box>
                                  </Group>
                                  <Tooltip label="Sync to Nextcloud">
                                    <ActionIcon
                                      size="sm"
                                      variant="light"
                                      color="blue"
                                      onClick={() => syncUser(user.id)}
                                      loading={syncingUsers.has(user.id)}
                                    >
                                      <ArrowRight size={14} />
                                    </ActionIcon>
                                  </Tooltip>
                                </Group>
                              </Paper>
                            ))}
                          </Stack>
                        )}
                      </ScrollArea>
                    </Stack>
                  </Paper>
                </Grid.Col>

                {/* MIDDLE: Synced Users */}
                <Grid.Col span={4}>
                  <Paper withBorder p="md" h={500} bg="var(--mantine-color-green-light)">
                    <Stack gap="sm" h="100%">
                      <Group justify="space-between">
                        <Text fw={600} size="sm">Synced Users</Text>
                        <Badge size="sm" color="green">{syncedUsers.length} connected</Badge>
                      </Group>
                      <Text size="xs" c="dimmed">App users with Nextcloud access</Text>
                      <Divider />
                      <ScrollArea h={400} offsetScrollbars>
                        {loadingApp ? (
                          <Center h={100}><Loader size="sm" /></Center>
                        ) : syncedUsers.length === 0 ? (
                          <Center h={100}>
                            <Text size="sm" c="dimmed">No synced users</Text>
                          </Center>
                        ) : (
                          <Stack gap="xs">
                            {syncedUsers.map((user) => (
                              <Paper key={user.id} withBorder p="xs" radius="sm" bg="white">
                                <Group justify="space-between" wrap="nowrap">
                                  <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                                    <Avatar size="sm" color="green" radius="xl">
                                      {(user.display_name || user.email)[0].toUpperCase()}
                                    </Avatar>
                                    <Box style={{ minWidth: 0 }}>
                                      <Group gap={4}>
                                        <Text size="xs" fw={500} truncate>
                                          {user.display_name || user.email.split('@')[0]}
                                        </Text>
                                        {user.is_admin && (
                                          <Badge size="xs" color="red" variant="light">
                                            Admin
                                          </Badge>
                                        )}
                                      </Group>
                                      <Text size="xs" c="dimmed" truncate>
                                        {user.email}
                                      </Text>
                                    </Box>
                                  </Group>
                                  <Tooltip label={user.is_admin ? 'Remove admin' : 'Make admin'}>
                                    <ActionIcon
                                      size="sm"
                                      variant="light"
                                      color={user.is_admin ? 'gray' : 'violet'}
                                      onClick={() => toggleAdmin(user.id, user.is_admin)}
                                      loading={togglingAdmin.has(user.id)}
                                    >
                                      <Shield size={14} />
                                    </ActionIcon>
                                  </Tooltip>
                                </Group>
                              </Paper>
                            ))}
                          </Stack>
                        )}
                      </ScrollArea>
                    </Stack>
                  </Paper>
                </Grid.Col>

                {/* RIGHT: Nextcloud Users */}
                <Grid.Col span={4}>
                  <Paper withBorder p="md" h={500} bg="var(--mantine-color-blue-light)">
                    <Stack gap="sm" h="100%">
                      <Group justify="space-between">
                        <Text fw={600} size="sm">Nextcloud Users</Text>
                        <Badge size="sm" color="blue">{nextcloudUsers.length} total</Badge>
                      </Group>
                      <Text size="xs" c="dimmed">Users in Nextcloud instance</Text>
                      <Divider />
                      <ScrollArea h={400} offsetScrollbars>
                        {loadingNc ? (
                          <Center h={100}><Loader size="sm" /></Center>
                        ) : nextcloudUsers.length === 0 ? (
                          <Center h={100}>
                            <Text size="sm" c="dimmed">No Nextcloud users found</Text>
                          </Center>
                        ) : (
                          <Stack gap="xs">
                            {nextcloudUsers.map((ncUser) => {
                              const matchingAppUser = getMatchingAppUser(ncUser.id);
                              const isLinked = !!matchingAppUser;

                              return (
                                <Paper key={ncUser.id} withBorder p="xs" radius="sm" bg="white">
                                  <Group justify="space-between" wrap="nowrap">
                                    <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                                      <Avatar size="sm" color={isLinked ? 'green' : 'blue'} radius="xl">
                                        {ncUser.displayName[0].toUpperCase()}
                                      </Avatar>
                                      <Box style={{ minWidth: 0 }}>
                                        <Group gap={4}>
                                          <Text size="xs" fw={500} truncate>
                                            {ncUser.displayName}
                                          </Text>
                                          {isLinked && (
                                            <Badge size="xs" color="green" variant="light">
                                              Linked
                                            </Badge>
                                          )}
                                        </Group>
                                        <Text size="xs" c="dimmed" truncate>
                                          {ncUser.email || ncUser.id.slice(0, 16) + '...'}
                                        </Text>
                                      </Box>
                                    </Group>
                                    {!ncUser.enabled && (
                                      <Tooltip label="Disabled">
                                        <Badge size="xs" color="red" variant="light">
                                          <X size={10} />
                                        </Badge>
                                      </Tooltip>
                                    )}
                                  </Group>
                                </Paper>
                              );
                            })}
                          </Stack>
                        )}
                      </ScrollArea>
                    </Stack>
                  </Paper>
                </Grid.Col>
              </Grid>

              {/* Legend */}
              <Paper withBorder p="sm">
                <Group gap="xl">
                  <Group gap="xs">
                    <Box w={12} h={12} bg="gray.2" style={{ borderRadius: 4 }} />
                    <Text size="xs" c="dimmed">Pending sync</Text>
                  </Group>
                  <Group gap="xs">
                    <Box w={12} h={12} bg="green.1" style={{ borderRadius: 4 }} />
                    <Text size="xs" c="dimmed">Synced (app + Nextcloud)</Text>
                  </Group>
                  <Group gap="xs">
                    <Box w={12} h={12} bg="blue.1" style={{ borderRadius: 4 }} />
                    <Text size="xs" c="dimmed">Nextcloud only</Text>
                  </Group>
                </Group>
              </Paper>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}
