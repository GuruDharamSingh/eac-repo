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
  Drawer,
  SegmentedControl,
  Select,
  ColorInput,
  Table,
  Box,
  Tooltip,
} from '@mantine/core';
import {
  Calendar,
  Cloud,
  LogOut,
  ChevronDown,
  User,
  MessageSquare,
  ClipboardList,
  Sparkles,
  Globe,
} from 'lucide-react';
import { signInWithPassword } from '@elkdonis/auth-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminMeeting {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  location: string | null;
  is_online: boolean;
  org_id: string;
  status: string;
  meeting_url: string | null;
  attendee_limit: number | null;
  show_on_workshops_page: boolean;
  workshop_order: number | null;
  subtitle: string | null;
  card_colour: string | null;
  card_accent_colour: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

type WorkshopStage = 'none' | 'standby' | 'upcoming' | 'featured';

interface WorkshopForm {
  stage: WorkshopStage;
  slot: string;
  subtitle: string;
  lead: string;
  format: string;
  workshopStatus: string;
  workshopType: string;
  capacity: string;
  cardColour: string;
  accentColour: string;
  enquireUrl: string;
}

interface Session {
  user: { id: string; email: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_COLOURS = ['#1a3a2a', '#1a1a3a', '#3a1a1a', '#2a3a1a', '#1a2a3a', '#3a2a1a'];
const ACCENT_COLOURS  = ['#4a9a6a', '#6a6ac9', '#c9626a', '#7ab85a', '#5a7ac9', '#c98a4a'];

const WORKSHOP_STATUSES = [
  'Available Now',
  'Forming',
  'In Development',
  'Seasonal',
  'Coming Soon',
  'On Hiatus',
];

const WORKSHOP_TYPES = [
  'Experiential Lab',
  'Writing Workshop',
  'Music Workshop',
  'Reading Group',
  'Nature Arts',
  'Healing Workshop',
  'Performance Lab',
  'Visual Arts',
  'Movement Practice',
];

function getStage(m: AdminMeeting): WorkshopStage {
  if (m.workshop_order !== null && m.show_on_workshops_page) return 'featured';
  if (m.show_on_workshops_page) return 'upcoming';
  const meta = workshopMeta(m);
  if (meta.lead || m.subtitle || m.card_colour) return 'standby';
  return 'none';
}

function workshopMeta(m: AdminMeeting): Record<string, string> {
  return ((m.metadata?.workshop ?? {}) as Record<string, string>);
}

function stageBadge(stage: WorkshopStage, order: number | null) {
  switch (stage) {
    case 'featured': return <Badge color="yellow" variant="filled">Featured #{order}</Badge>;
    case 'upcoming': return <Badge color="teal"   variant="light">Upcoming</Badge>;
    case 'standby':  return <Badge color="gray"   variant="light">Standby</Badge>;
    default:         return <Badge color="gray"   variant="outline" opacity={0.4}>—</Badge>;
  }
}

function blankForm(): WorkshopForm {
  return {
    stage: 'none', slot: '1',
    subtitle: '', lead: '', format: '',
    workshopStatus: 'Available Now', workshopType: '', capacity: '',
    cardColour: '#1a3a2a', accentColour: '#4a9a6a', enquireUrl: '',
  };
}

function formFromMeeting(m: AdminMeeting): WorkshopForm {
  const meta = workshopMeta(m);
  return {
    stage: getStage(m),
    slot: m.workshop_order ? String(m.workshop_order) : '1',
    subtitle: m.subtitle ?? '',
    lead: meta.lead ?? '',
    format: meta.format ?? '',
    workshopStatus: meta.workshopStatus ?? 'Available Now',
    workshopType: meta.workshopType ?? '',
    capacity: meta.capacity ?? (m.attendee_limit ? `Up to ${m.attendee_limit} participants` : ''),
    cardColour: m.card_colour ?? '#1a3a2a',
    accentColour: m.card_accent_colour ?? '#4a9a6a',
    enquireUrl: m.meeting_url ?? '',
  };
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function MeetingsPage() {
  const router = useRouter();

  const [session, setSession]     = useState<Session | null>(null);
  const [loading, setLoading]     = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const [loginOpen, setLoginOpen] = useState(false);
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [meetings, setMeetings]   = useState<AdminMeeting[]>([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing]       = useState<AdminMeeting | null>(null);
  const [form, setForm]             = useState<WorkshopForm>(blankForm());
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);

  // ── Auth ───────────────────────────────────────────────────────────────────

  useEffect(() => { checkSession(); }, []);

  const checkSession = async () => {
    try {
      const res  = await fetch('/api/auth/session');
      const data = await res.json();
      setSession(data);
      if (!data.user) setLoginOpen(true);
      else fetchMeetings();
    } catch {
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
        setMeetings(data.meetings ?? []);
      }
    } catch (err) {
      console.error('Failed to fetch meetings:', err);
    }
  };

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null);
    if (!email || !password) { setAuthError('Email and password are required.'); return; }
    startTransition(async () => {
      const { error } = await signInWithPassword(email, password);
      if (error) { setAuthError(error); return; }
      setEmail(''); setPassword('');
      setLoginOpen(false);
      await checkSession();
      router.refresh();
    });
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setSession(null); setMeetings([]);
      setLoginOpen(true);
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  };

  // ── Drawer ─────────────────────────────────────────────────────────────────

  const openDrawer = (m: AdminMeeting) => {
    setEditing(m);
    setForm(formFromMeeting(m));
    setSaveError(null);
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/meetings/${editing.id}/workshop`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: form.stage,
          workshop_order: form.stage === 'featured' ? Number(form.slot) : null,
          subtitle: form.subtitle || null,
          card_colour: form.cardColour || null,
          card_accent_colour: form.accentColour || null,
          meeting_url: form.enquireUrl || null,
          meta_lead: form.lead,
          meta_format: form.format,
          meta_workshop_status: form.workshopStatus,
          meta_workshop_type: form.workshopType,
          meta_capacity: form.capacity,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error ?? 'Save failed'); return; }
      setDrawerOpen(false);
      fetchMeetings();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const featuredSlots = [1, 2, 3].map(
    (slot) => meetings.find((m) => m.workshop_order === slot && m.show_on_workshops_page) ?? null
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Container size="sm" py="xl">
        <Center h={200}><Loader size="lg" /></Center>
      </Container>
    );
  }

  return (
    <>
      {/* ── Login Modal ──────────────────────────────────────────────────────── */}
      <Modal
        opened={loginOpen}
        onClose={() => { if (session?.user) setLoginOpen(false); }}
        title="Sign in to Elkdonis Admin"
        centered closeOnClickOutside={false} closeOnEscape={false}
        withCloseButton={!!session?.user}
      >
        <Stack gap="lg">
          <Text size="sm" c="dimmed">Sign in to access the admin dashboard</Text>
          {authError && <Alert color="red" radius="md">{authError}</Alert>}
          <form onSubmit={handleLogin}>
            <Stack gap="md">
              <TextInput label="Email" type="email" value={email}
                onChange={(e) => setEmail(e.currentTarget.value)} required />
              <PasswordInput label="Password" value={password}
                onChange={(e) => setPassword(e.currentTarget.value)} required />
              <Button type="submit" loading={isPending} fullWidth>Sign in</Button>
            </Stack>
          </form>
        </Stack>
      </Modal>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      {session?.user && (
        <Paper shadow="xs" py="sm" mb="md">
          <Container size="lg">
            <Group justify="space-between">
              <Group gap="md">
                <Title order={3}>Elkdonis Admin</Title>
                <Divider orientation="vertical" />
                <Group gap="xs">
                  <Button component={Link} href="/" variant="subtle" size="sm" leftSection={<Calendar size={16} />}>Meetings</Button>
                  <Button component={Link} href="/messages" variant="subtle" size="sm" leftSection={<MessageSquare size={16} />}>Messages</Button>
                  <Button component={Link} href="/rsvp" variant="subtle" size="sm" leftSection={<ClipboardList size={16} />}>RSVPs</Button>
                  <Button component={Link} href="/nextcloud" variant="subtle" size="sm" leftSection={<Cloud size={16} />}>Nextcloud</Button>
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
                <Menu.Dropdown>
                  <Menu.Label>Signed in as</Menu.Label>
                  <Menu.Item leftSection={<User size={14} />}>
                    <Text size="sm" fw={500}>{session.user.email}</Text>
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item component={Link} href="/nextcloud" leftSection={<Cloud size={14} />}>
                    Nextcloud Integration
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item color="red" leftSection={<LogOut size={14} />}
                    onClick={handleLogout} disabled={loggingOut}>
                    {loggingOut ? 'Logging out…' : 'Logout'}
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Container>
        </Paper>
      )}

      {session?.user && (
        <Container size="lg" py="xl">
          <Stack gap="xl">

            {/* ── Page Header ──────────────────────────────────────────────── */}
            <div>
              <Title order={2}>Meetings</Title>
              <Text size="sm" c="dimmed">
                Manage sessions and promote workshops to the public site.
              </Text>
            </div>

            {/* ── Featured Slots Strip ─────────────────────────────────────── */}
            <div>
              <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb="xs"
                style={{ letterSpacing: '0.08em' }}>
                Live on /workshops — Featured Cards
              </Text>
              <Group gap="sm" grow>
                {featuredSlots.map((m, i) => (
                  <Paper
                    key={i} withBorder radius="md" p="sm"
                    style={{
                      borderColor: m ? '#c9a962' : undefined,
                      background:  m ? '#fffdf5' : undefined,
                      minHeight: 80,
                    }}
                  >
                    <Group gap="xs" align="flex-start" wrap="nowrap">
                      <Text size="xs" fw={700} c="dimmed" style={{ minWidth: 16, paddingTop: 2 }}>
                        {i + 1}
                      </Text>
                      {m ? (
                        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                          <Text size="sm" fw={600} lineClamp={1}>{m.title}</Text>
                          <Group gap={4}>
                            <Badge size="xs" color="yellow" variant="light">{m.org_id}</Badge>
                            {m.subtitle && (
                              <Text size="xs" c="dimmed" lineClamp={1}>{m.subtitle}</Text>
                            )}
                          </Group>
                          <Button size="xs" variant="subtle" color="gray" mt={2}
                            onClick={() => openDrawer(m)}
                            style={{ alignSelf: 'flex-start', padding: '0 6px' }}>
                            Edit
                          </Button>
                        </Stack>
                      ) : (
                        <Text size="xs" c="dimmed" fs="italic" style={{ paddingTop: 2 }}>
                          Empty slot
                        </Text>
                      )}
                    </Group>
                  </Paper>
                ))}
              </Group>
            </div>

            {/* ── Meetings Table ───────────────────────────────────────────── */}
            <Paper withBorder radius="md">
              <Table striped highlightOnHover verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Title</Table.Th>
                    <Table.Th>Org</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Workshop</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {meetings.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={5}>
                        <Center py="xl"><Text c="dimmed">No meetings found</Text></Center>
                      </Table.Td>
                    </Table.Tr>
                  ) : meetings.map((m) => {
                    const stage = getStage(m);
                    return (
                      <Table.Tr key={m.id}>
                        <Table.Td>
                          <Stack gap={2}>
                            <Text size="sm" fw={500}>{m.title}</Text>
                            {m.subtitle && <Text size="xs" c="dimmed">{m.subtitle}</Text>}
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Badge size="sm" variant="light" color="blue">{m.org_id}</Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {m.scheduled_at
                              ? new Date(m.scheduled_at).toLocaleDateString('en-CA', {
                                  year: 'numeric', month: 'short', day: 'numeric',
                                })
                              : '—'}
                          </Text>
                        </Table.Td>
                        <Table.Td>{stageBadge(stage, m.workshop_order)}</Table.Td>
                        <Table.Td>
                          <Tooltip
                            label={stage === 'none' ? 'Promote to workshops page' : 'Edit workshop details'}
                            withArrow
                          >
                            <Button
                              size="xs"
                              variant={stage === 'none' ? 'light' : 'filled'}
                              color={stage === 'none' ? 'gray' : 'yellow'}
                              leftSection={stage === 'none'
                                ? <Sparkles size={12} />
                                : <Globe size={12} />}
                              onClick={() => openDrawer(m)}
                            >
                              {stage === 'none' ? 'Promote' : 'Manage'}
                            </Button>
                          </Tooltip>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Paper>

          </Stack>
        </Container>
      )}

      {/* ── Workshop Drawer ──────────────────────────────────────────────────── */}
      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        position="right"
        size="md"
        title={
          <Stack gap={2}>
            <Text fw={700} size="sm">{editing?.title}</Text>
            <Badge size="xs" variant="light" color="blue">{editing?.org_id}</Badge>
          </Stack>
        }
      >
        <Stack gap="lg" p="xs">

          {/* Stage selector */}
          <div>
            <Text size="xs" fw={600} c="dimmed" mb={6} tt="uppercase"
              style={{ letterSpacing: '0.06em' }}>
              Stage
            </Text>
            <SegmentedControl
              fullWidth
              value={form.stage}
              onChange={(v) => setForm({ ...form, stage: v as WorkshopStage })}
              data={[
                { label: 'None',     value: 'none'     },
                { label: 'Standby',  value: 'standby'  },
                { label: 'Upcoming', value: 'upcoming' },
                { label: 'Featured', value: 'featured' },
              ]}
            />
            <Text size="xs" c="dimmed" mt={6}>
              {form.stage === 'none'     && 'Not on the workshops page.'}
              {form.stage === 'standby'  && 'Metadata saved. Completely hidden from public.'}
              {form.stage === 'upcoming' && 'Visible in the "Also on the Horizon" table.'}
              {form.stage === 'featured' && 'One of the 3 live featured workshop cards.'}
            </Text>
          </div>

          {form.stage === 'featured' && (
            <Select
              label="Featured Slot"
              description="Card position 1–3 on the workshops page"
              value={form.slot}
              onChange={(v) => setForm({ ...form, slot: v ?? '1' })}
              allowDeselect={false}
              data={[
                { value: '1', label: 'Slot 1' },
                { value: '2', label: 'Slot 2' },
                { value: '3', label: 'Slot 3' },
              ]}
            />
          )}

          <Divider label="Workshop Details" labelPosition="left" />

          <TextInput
            label="Subtitle"
            description="Short descriptor shown under the title"
            placeholder="e.g. Creative Writing Laboratory"
            value={form.subtitle}
            onChange={(e) => setForm({ ...form, subtitle: e.currentTarget.value })}
          />

          <TextInput
            label="Facilitator"
            placeholder="e.g. Dana McCool"
            value={form.lead}
            onChange={(e) => setForm({ ...form, lead: e.currentTarget.value })}
          />

          <TextInput
            label="Format"
            placeholder="e.g. Online workshop · 3 sessions"
            value={form.format}
            onChange={(e) => setForm({ ...form, format: e.currentTarget.value })}
          />

          <TextInput
            label="Capacity"
            description="Leave blank to derive from attendee limit"
            placeholder="e.g. 6–12 participants"
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.currentTarget.value })}
          />

          <Select
            label="Status Label"
            value={form.workshopStatus}
            onChange={(v) => setForm({ ...form, workshopStatus: v ?? 'Available Now' })}
            data={WORKSHOP_STATUSES}
            allowDeselect={false}
          />

          <Select
            label="Workshop Type"
            description="Used in the upcoming table"
            placeholder="Select a type"
            value={form.workshopType || null}
            onChange={(v) => setForm({ ...form, workshopType: v ?? '' })}
            data={WORKSHOP_TYPES}
            clearable
          />

          <TextInput
            label="Enquire URL"
            description="Link for the 'Enquire →' button on the card"
            placeholder="https://…"
            value={form.enquireUrl}
            onChange={(e) => setForm({ ...form, enquireUrl: e.currentTarget.value })}
          />

          <Divider label="Card Colours" labelPosition="left" />

          <Group grow>
            <ColorInput
              label="Card Background"
              value={form.cardColour}
              onChange={(v) => setForm({ ...form, cardColour: v })}
              swatches={DEFAULT_COLOURS}
              swatchesPerRow={6}
              format="hex"
            />
            <ColorInput
              label="Accent / CTA"
              value={form.accentColour}
              onChange={(v) => setForm({ ...form, accentColour: v })}
              swatches={ACCENT_COLOURS}
              swatchesPerRow={6}
              format="hex"
            />
          </Group>

          <Box
            style={{
              height: 40, borderRadius: 8,
              background: form.cardColour,
              border: `2px solid ${form.accentColour}`,
              display: 'flex', alignItems: 'center', paddingInline: 12,
            }}
          >
            <Text size="xs" fw={600} style={{ color: form.accentColour }}>
              {form.subtitle || editing?.title}
            </Text>
          </Box>

          {saveError && <Alert color="red" radius="md">{saveError}</Alert>}

          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" color="gray" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button color="yellow" loading={saving} onClick={handleSave}>
              Save
            </Button>
          </Group>

        </Stack>
      </Drawer>
    </>
  );
}
