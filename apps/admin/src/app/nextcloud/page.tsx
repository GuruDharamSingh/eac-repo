'use client';

import { useState } from 'react';
import { Container, Title, Text, Tabs, Stack, Paper, Button, Group } from '@mantine/core';
import { FileBrowser, TalkRoom } from '@elkdonis/ui';
import { FolderOpen, MessageCircle, Users, Plus } from 'lucide-react';

export default function NextcloudPage() {
  const [activeTab, setActiveTab] = useState('files');
  const orgId = 'elkdonis'; // This would come from user context in production

  // Mock Talk room data - in production, load from database
  const [talkRooms] = useState([
    { token: 'meeting-1', name: 'Weekly Standup' },
    { token: 'meeting-2', name: 'Project Discussion' },
  ]);

  const [selectedRoom, setSelectedRoom] = useState(talkRooms[0]);

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
              <Text size="sm" c="dimmed">
                Sync users between your app and Nextcloud
              </Text>
              <Paper withBorder p="lg">
                <Stack gap="md">
                  <Group justify="space-between">
                    <div>
                      <Text fw={600}>Auto-sync Users</Text>
                      <Text size="sm" c="dimmed">
                        Automatically create Nextcloud accounts for new users
                      </Text>
                    </div>
                    <Button
                      onClick={async () => {
                        const response = await fetch('/api/nextcloud/sync-users', {
                          method: 'POST',
                        });
                        if (response.ok) {
                          alert('Users synced successfully!');
                        }
                      }}
                    >
                      Sync Now
                    </Button>
                  </Group>

                  <Group justify="space-between">
                    <div>
                      <Text fw={600}>Create Organization Folders</Text>
                      <Text size="sm" c="dimmed">
                        Set up folder structure for all organizations
                      </Text>
                    </div>
                    <Button
                      onClick={async () => {
                        const response = await fetch('/api/nextcloud/setup-folders', {
                          method: 'POST',
                        });
                        if (response.ok) {
                          alert('Folders created successfully!');
                        }
                      }}
                    >
                      Create Folders
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}