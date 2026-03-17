'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Title,
  Text,
  Stack,
  Paper,
  Button,
  Group,
  Badge,
  Loader,
  Center,
  Select,
  Table,
  Textarea,
  Modal,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { ClipboardList, RefreshCw } from 'lucide-react';

interface RsvpRow {
  id: string;
  meeting_id: string;
  meeting_title: string;
  section: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  wants_reminder: boolean;
  created_at: string;
}

const SECTION_OPTIONS = [
  { value: 'all', label: 'All Sections' },
  { value: 'amrit_vela', label: 'Amrit Vela Sadhana' },
  { value: 'yoga', label: 'Yoga Classes' },
  { value: 'gurdwara', label: 'Gurdwara / Langar' },
];

const SECTION_COLORS: Record<string, string> = {
  amrit_vela: 'yellow',
  yoga: 'green',
  gurdwara: 'red',
};

export default function RsvpPage() {
  const [rsvps, setRsvps] = useState<RsvpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectionFilter, setSectionFilter] = useState('all');
  const [selected, setSelected] = useState<RsvpRow | null>(null);
  const [opened, { open, close }] = useDisclosure(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sectionFilter !== 'all') params.set('section', sectionFilter);
      const res = await fetch(`/api/rsvp?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRsvps(data.rsvps ?? []);
      }
    } catch (e) {
      console.error('Error loading RSVPs:', e);
    } finally {
      setLoading(false);
    }
  }, [sectionFilter]);

  useEffect(() => { load(); }, [load]);

  const openDetail = (row: RsvpRow) => {
    setSelected(row);
    open();
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <Group justify="space-between" align="flex-start">
          <div>
            <Group gap="sm">
              <ClipboardList size={28} />
              <Title order={2}>RSVP Responses</Title>
              <Badge color="orange" size="lg" variant="filled">{rsvps.length}</Badge>
            </Group>
            <Text c="dimmed" size="sm" mt={4}>
              Guest RSVPs from Amrit Canada section pages (no login required)
            </Text>
          </div>
          <Button
            variant="light"
            leftSection={<RefreshCw size={16} />}
            onClick={load}
            loading={loading}
          >
            Refresh
          </Button>
        </Group>

        <Paper withBorder p="md">
          <Group>
            <Select
              value={sectionFilter}
              onChange={(v) => setSectionFilter(v || 'all')}
              data={SECTION_OPTIONS}
              size="sm"
              w={220}
              styles={{
                input: { backgroundColor: '#fff', color: '#212529', fontWeight: 500 },
                dropdown: { backgroundColor: '#fff' },
                option: { color: '#212529', fontWeight: 500 },
              }}
            />
            <Badge variant="light" size="lg">{rsvps.length} responses</Badge>
          </Group>
        </Paper>

        <Paper withBorder>
          {loading ? (
            <Center h={300}><Loader /></Center>
          ) : rsvps.length === 0 ? (
            <Center h={200}>
              <Stack align="center" gap="xs">
                <ClipboardList size={48} color="gray" />
                <Text c="dimmed">No RSVP responses yet</Text>
              </Stack>
            </Center>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Meeting</Table.Th>
                  <Table.Th>Section</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Phone</Table.Th>
                  <Table.Th>Reminder</Table.Th>
                  <Table.Th>Date</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rsvps.map((row) => (
                  <Table.Tr
                    key={row.id}
                    style={{ cursor: row.message ? 'pointer' : undefined }}
                    onClick={() => row.message && openDetail(row)}
                  >
                    <Table.Td>
                      <Text size="sm" fw={500} c="dark" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.meeting_title}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {row.section ? (
                        <Badge size="xs" color={SECTION_COLORS[row.section] ?? 'gray'} variant="light">
                          {row.section.replace('_', ' ')}
                        </Badge>
                      ) : (
                        <Text size="xs" c="dimmed">—</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>{row.name}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="gray.7" style={{ fontFamily: 'monospace' }}>{row.email ?? '—'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="gray.7">{row.phone ?? '—'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" color={row.wants_reminder ? 'teal' : 'gray'} variant="light">
                        {row.wants_reminder ? 'Yes' : 'No'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {new Date(row.created_at).toLocaleDateString()}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      </Stack>

      <Modal
        opened={opened}
        onClose={close}
        title={
          <Group gap="sm">
            <ClipboardList size={18} />
            <Text fw={600}>Message from {selected?.name}</Text>
          </Group>
        }
        size="md"
      >
        {selected && (
          <Stack gap="md">
            <Group gap="xl">
              <Stack gap={2}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.05em' }}>Meeting</Text>
                <Text size="sm" fw={500}>{selected.meeting_title}</Text>
              </Stack>
              <Stack gap={2}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.05em' }}>Date</Text>
                <Text size="sm">{new Date(selected.created_at).toLocaleString()}</Text>
              </Stack>
            </Group>
            <Stack gap={4}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.05em' }}>Question / Note</Text>
              <Textarea
                value={selected.message ?? ''}
                readOnly
                autosize
                minRows={3}
                styles={{ input: { backgroundColor: '#f8f9fa', color: '#212529' } }}
              />
            </Stack>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
