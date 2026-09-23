export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { db } from '@elkdonis/db';
import { listOrders } from '@elkdonis/commerce/queries';
import {
  Container,
  Stack,
  Title,
  Text,
  SimpleGrid,
  Paper,
  Group,
  Badge,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import {
  Calendar,
  CalendarClock,
  Users,
  Mail,
  Receipt,
  ClipboardList,
  Activity,
  Cloud,
  KeyRound,
  ArrowRight,
} from 'lucide-react';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  href: string;
}

function StatCard({ icon, label, value, color, href }: StatCardProps) {
  return (
    <UnstyledButton component={Link} href={href}>
      <Paper withBorder radius="lg" p="lg" h="100%">
        <Stack gap="xs">
          <ThemeIcon size="lg" radius="md" variant="light" color={color}>
            {icon}
          </ThemeIcon>
          <Text size="xl" fw={700}>{value}</Text>
          <Text size="sm" c="dimmed">{label}</Text>
        </Stack>
      </Paper>
    </UnstyledButton>
  );
}

interface QuickLinkProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  href: string;
}

function QuickLink({ icon, label, description, href }: QuickLinkProps) {
  return (
    <UnstyledButton component={Link} href={href}>
      <Paper withBorder radius="md" p="md">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon size="md" radius="md" variant="light" color="gray">
              {icon}
            </ThemeIcon>
            <div>
              <Text size="sm" fw={600}>{label}</Text>
              <Text size="xs" c="dimmed">{description}</Text>
            </div>
          </Group>
          <ArrowRight size={16} color="var(--mantine-color-dimmed)" />
        </Group>
      </Paper>
    </UnstyledButton>
  );
}

export default async function OverviewPage() {
  const [
    [{ count: totalMeetings }],
    [{ count: upcomingMeetings }],
    [{ count: totalUsers }],
    [{ count: newContacts }],
    [{ count: upcomingRsvps }],
    orders,
  ] = await Promise.all([
    db`SELECT COUNT(*)::int AS count FROM threads WHERE kind = 'meeting'`,
    db`SELECT COUNT(*)::int AS count FROM threads WHERE kind = 'meeting' AND scheduled_at > NOW()`,
    db`SELECT COUNT(*)::int AS count FROM users`,
    db`SELECT COUNT(*)::int AS count FROM contacts WHERE status = 'new'`,
    db`SELECT COUNT(*)::int AS count FROM thread_rsvps WHERE status = 'yes'`,
    listOrders({ limit: 500, status: ['awaiting_etransfer', 'pending_payment'] }),
  ]);

  const pendingOrders = orders.length;

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <div>
          <Title order={2}>Overview</Title>
          <Text size="sm" c="dimmed">
            Everything happening across the Elkdonis network, in one place.
          </Text>
        </div>

        <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="md">
          <StatCard
            icon={<Calendar size={18} />}
            label="Meetings"
            value={totalMeetings}
            color="blue"
            href="/meetings"
          />
          <StatCard
            icon={<CalendarClock size={18} />}
            label="Upcoming"
            value={upcomingMeetings}
            color="indigo"
            href="/meetings"
          />
          <StatCard
            icon={<Users size={18} />}
            label="Users"
            value={totalUsers}
            color="grape"
            href="/users"
          />
          <StatCard
            icon={<Mail size={18} />}
            label="New Contacts"
            value={newContacts}
            color="orange"
            href="/users"
          />
          <StatCard
            icon={<Receipt size={18} />}
            label="Pending Orders"
            value={pendingOrders}
            color="yellow"
            href="/orders"
          />
          <StatCard
            icon={<ClipboardList size={18} />}
            label="RSVPs"
            value={upcomingRsvps}
            color="teal"
            href="/rsvp"
          />
        </SimpleGrid>

        <div>
          <Title order={4} mb="sm">Every section, one click away</Title>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <QuickLink
              icon={<Calendar size={16} />}
              label="Meetings"
              description="Manage sessions and promote workshops"
              href="/meetings"
            />
            <QuickLink
              icon={<Users size={16} />}
              label="Users & Contacts"
              description="Roles, org membership, and inbound messages"
              href="/users"
            />
            <QuickLink
              icon={<Receipt size={16} />}
              label="Orders"
              description="Confirm payments and fulfil commerce orders"
              href="/orders"
            />
            <QuickLink
              icon={<ClipboardList size={16} />}
              label="RSVPs"
              description="See who's coming to upcoming sessions"
              href="/rsvp"
            />
            <QuickLink
              icon={<Activity size={16} />}
              label="Activity & Moderation"
              description="Network-wide activity log and content moderation"
              href="/events"
            />
            <QuickLink
              icon={<Cloud size={16} />}
              label="Nextcloud"
              description="Files, Talk rooms, and user sync"
              href="/nextcloud"
            />
            <QuickLink
              icon={<KeyRound size={16} />}
              label="Org Access Grants"
              description="Let org owners self-serve Nextcloud member sync"
              href="/org-grants"
            />
            <QuickLink
              icon={<Mail size={16} />}
              label="Email Templates"
              description="Preview every transactional email"
              href="/email-templates"
            />
          </SimpleGrid>
        </div>

        {newContacts > 0 && (
          <Paper withBorder radius="md" p="md" style={{ borderColor: '#f59f00', background: '#fff9db' }}>
            <Group justify="space-between">
              <Group gap="sm">
                <Badge color="orange" size="lg" variant="filled">{newContacts}</Badge>
                <Text size="sm" fw={500}>new contact submission{newContacts === 1 ? '' : 's'} waiting for review</Text>
              </Group>
              <Text component={Link} href="/users" size="sm" fw={600} c="orange.8">
                Review now →
              </Text>
            </Group>
          </Paper>
        )}
      </Stack>
    </Container>
  );
}
