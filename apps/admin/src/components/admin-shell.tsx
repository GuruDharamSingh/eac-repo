'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AppShell,
  Burger,
  Group,
  Stack,
  Title,
  Text,
  NavLink,
  Paper,
  Avatar,
  Menu,
  UnstyledButton,
  Loader,
  Center,
  Container,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  LayoutDashboard,
  Calendar,
  Plus,
  Users,
  Receipt,
  Activity,
  ClipboardList,
  Mail,
  Cloud,
  KeyRound,
  ChevronDown,
  LogOut,
  User,
} from 'lucide-react';
import { LoginForm } from './login-form';

interface Session {
  user: { id: string; email: string } | null;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [{ href: '/', label: 'Overview', icon: LayoutDashboard }],
  },
  {
    title: 'Meetings & Workshops',
    items: [
      { href: '/meetings', label: 'Meetings', icon: Calendar },
      { href: '/new', label: 'New Meeting', icon: Plus },
      { href: '/rsvp', label: 'RSVPs', icon: ClipboardList },
    ],
  },
  {
    title: 'People',
    items: [{ href: '/users', label: 'Users & Contacts', icon: Users }],
  },
  {
    title: 'Commerce',
    items: [{ href: '/orders', label: 'Orders', icon: Receipt }],
  },
  {
    title: 'Network',
    items: [
      { href: '/events', label: 'Activity & Moderation', icon: Activity },
      { href: '/nextcloud', label: 'Nextcloud', icon: Cloud },
      { href: '/org-grants', label: 'Org Access Grants', icon: KeyRound },
      { href: '/email-templates', label: 'Email Templates', icon: Mail },
    ],
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [opened, { toggle }] = useDisclosure();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      setSession(data);
    } catch {
      setSession({ user: null });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setSession({ user: null });
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  };

  // The /login route handles its own returnTo-based OAuth flow — let it render
  // without the shell wrapping it (it needs to work while fully signed out).
  if (pathname === '/login') {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    );
  }

  if (!session?.user) {
    return (
      <Center h="100vh" bg="var(--mantine-color-gray-0)">
        <Container size="xs" w="100%">
          <Paper withBorder radius="lg" p="xl" shadow="sm">
            <Stack gap="lg" align="center" mb="md">
              <Title order={2}>Elkdonis Admin</Title>
            </Stack>
            <LoginForm onSuccess={checkSession} />
          </Paper>
        </Container>
      </Center>
    );
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={4}>Elkdonis Admin</Title>
          </Group>
          <Menu shadow="md" width={220} position="bottom-end">
            <Menu.Target>
              <UnstyledButton>
                <Paper withBorder px="sm" py={6} radius="md">
                  <Group gap="xs">
                    <Avatar size="sm" color="blue" radius="xl">
                      {session.user.email[0].toUpperCase()}
                    </Avatar>
                    <Stack gap={0} visibleFrom="xs">
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
            <Menu.Dropdown>
              <Menu.Label>Signed in as</Menu.Label>
              <Menu.Item leftSection={<User size={14} />}>
                <Text size="sm" fw={500}>{session.user.email}</Text>
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                color="red"
                leftSection={<LogOut size={14} />}
                onClick={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut ? 'Logging out…' : 'Logout'}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <Stack gap="lg">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb={4} px={4}
                style={{ letterSpacing: '0.06em' }}>
                {section.title}
              </Text>
              <Stack gap={2}>
                {section.items.map((item) => (
                  <NavLink
                    key={item.href}
                    component={Link}
                    href={item.href}
                    label={item.label}
                    leftSection={<item.icon size={16} />}
                    active={pathname === item.href}
                    variant="light"
                    onClick={opened ? toggle : undefined}
                  />
                ))}
              </Stack>
            </div>
          ))}
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
