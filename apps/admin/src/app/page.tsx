'use client';

import { useState, useEffect, useTransition, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Container,
  Group,
  Stack,
  Title,
  Text,
  Paper,
  Modal,
  TextInput,
  PasswordInput,
  Button,
  Alert,
  Loader,
  Center,
  Avatar,
  Menu,
  UnstyledButton,
  Divider,
  Badge,
} from '@mantine/core';
import { Calendar, Cloud, LogOut, ChevronDown, User } from 'lucide-react';
import { signInWithPassword } from '@elkdonis/auth-client';

interface Meeting {
  id: string;
  title: string;
  scheduled_at: string;
  location: string | null;
  description: string | null;
}

interface Session {
  user: {
    id: string;
    email: string;
  } | null;
}

export default function MeetingsPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loggingOut, setLoggingOut] = useState(false);

  // Login modal state
  const [loginOpen, setLoginOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Check session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      setSession(data);

      if (!data.user) {
        setLoginOpen(true);
      } else {
        fetchMeetings();
      }
    } catch (err) {
      console.error('Session check failed:', err);
      setLoginOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeetings = async () => {
    try {
      const res = await fetch('/api/meetings');
      if (res.ok) {
        const data = await res.json();
        setMeetings(data.meetings || []);
      }
    } catch (err) {
      console.error('Failed to fetch meetings:', err);
    }
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    startTransition(async () => {
      const { error: signInError } = await signInWithPassword(email, password);

      if (signInError) {
        setError(signInError);
        return;
      }

      setEmail('');
      setPassword('');
      setLoginOpen(false);

      await checkSession();
      router.refresh();
    });
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setSession(null);
      setMeetings([]);
      setLoginOpen(true);
      router.refresh();
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <Container size="sm" py="xl">
        <Center h={200}>
          <Loader size="lg" />
        </Center>
      </Container>
    );
  }

  return (
    <>
      {/* Login Modal */}
      <Modal
        opened={loginOpen}
        onClose={() => {
          if (session?.user) {
            setLoginOpen(false);
          }
        }}
        title="Sign in to Elkdonis Admin"
        centered
        closeOnClickOutside={false}
        closeOnEscape={false}
        withCloseButton={!!session?.user}
      >
        <Stack gap="lg">
          <Text size="sm" c="dimmed">
            Sign in to access the admin dashboard
          </Text>

          {error && (
            <Alert color="red" radius="md">
              {error}
            </Alert>
          )}

          <form onSubmit={handleLogin}>
            <Stack gap="md">
              <TextInput
                label="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                placeholder="your@email.com"
                required
              />
              <PasswordInput
                label="Password"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                placeholder="Your password"
                required
              />
              <Button type="submit" loading={isPending} disabled={isPending} fullWidth>
                Sign in
              </Button>
            </Stack>
          </form>
        </Stack>
      </Modal>

      {/* Header with user info and navigation */}
      {session?.user && (
        <Paper shadow="xs" py="sm" mb="md">
          <Container size="lg">
            <Group justify="space-between">
              <Group gap="md">
                <Title order={3}>Elkdonis Admin</Title>
                <Divider orientation="vertical" />
                <Group gap="xs">
                  <Button
                    component={Link}
                    href="/"
                    variant="subtle"
                    size="sm"
                    leftSection={<Calendar size={16} />}
                  >
                    Meetings
                  </Button>
                  <Button
                    component={Link}
                    href="/nextcloud"
                    variant="subtle"
                    size="sm"
                    leftSection={<Cloud size={16} />}
                  >
                    Nextcloud
                  </Button>
                </Group>
              </Group>

              <Menu shadow="md" width={220} position="bottom-end">
                <Menu.Target>
                  <UnstyledButton>
                    <Paper withBorder px="sm" py="xs" radius="md">
                      <Group gap="xs">
                        <Avatar size="sm" color="blue" radius="xl">
                          {session.user.email[0].toUpperCase()}
                        </Avatar>
                        <Stack gap={0}>
                          <Text size="sm" fw={500} style={{ lineHeight: 1.2 }}>
                            {session.user.email.split('@')[0]}
                          </Text>
                          <Text size="xs" c="dimmed" style={{ lineHeight: 1.2 }}>
                            {session.user.email}
                          </Text>
                        </Stack>
                        <ChevronDown size={14} />
                      </Group>
                    </Paper>
                  </UnstyledButton>
                </Menu.Target>

                <Menu.Dropdown style={{ backgroundColor: '#fff' }}>
                  <Menu.Label style={{ color: '#495057', fontWeight: 600 }}>
                    Signed in as
                  </Menu.Label>
                  <Menu.Item
                    leftSection={<User size={14} />}
                    style={{ color: '#212529' }}
                  >
                    <Text size="sm" fw={500}>{session.user.email}</Text>
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Label style={{ color: '#495057', fontWeight: 600 }}>
                    Navigation
                  </Menu.Label>
                  <Menu.Item
                    component={Link}
                    href="/nextcloud"
                    leftSection={<Cloud size={14} />}
                    style={{ color: '#212529' }}
                  >
                    Nextcloud Integration
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    color="red"
                    leftSection={<LogOut size={14} />}
                    onClick={handleLogout}
                    disabled={loggingOut}
                    style={{ color: '#c92a2a', fontWeight: 500 }}
                  >
                    {loggingOut ? 'Logging out...' : 'Logout'}
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Container>
        </Paper>
      )}

      {/* Main Content */}
      <Container size="sm" py="xl">
        <Stack gap="xl">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Group gap="sm">
                <Paper radius="md" withBorder px="xs" py={4}>
                  <Calendar className="h-5 w-5" />
                </Paper>
                <div>
                  <Title order={2}>Meetings</Title>
                  <Text size="sm" c="dimmed">
                    Stay on top of upcoming sessions and follow-ups.
                  </Text>
                </div>
              </Group>
            </Stack>
          </Group>

          <Stack gap="md">
            {!session?.user ? (
              <Paper withBorder radius="lg" p="xl" ta="center">
                <Text c="dimmed">Please sign in to view meetings</Text>
                <Button mt="md" onClick={() => setLoginOpen(true)}>
                  Sign In
                </Button>
              </Paper>
            ) : meetings.length > 0 ? (
              meetings.map((meeting) => (
                <Paper key={meeting.id} withBorder radius="lg" p="md">
                  <Stack gap="xs">
                    <Title order={4}>{meeting.title}</Title>
                    <Text size="sm" c="dimmed">
                      {new Date(meeting.scheduled_at).toLocaleString()}
                    </Text>
                    {meeting.location && (
                      <Text size="sm">{meeting.location}</Text>
                    )}
                    {meeting.description && (
                      <Text size="sm" c="dimmed">{meeting.description}</Text>
                    )}
                  </Stack>
                </Paper>
              ))
            ) : (
              <Paper withBorder radius="lg" p="xl" ta="center">
                <Calendar className="mx-auto mb-3 h-12 w-12 text-gray-400" />
                <Text c="dimmed">No meetings scheduled</Text>
              </Paper>
            )}
          </Stack>
        </Stack>
      </Container>
    </>
  );
}
