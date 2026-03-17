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
  ActionIcon,
  Tooltip,
  Modal,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  MessageSquare,
  RefreshCw,
  Search,
  X,
  Mail,
  UserCheck,
  Eye,
} from 'lucide-react';

interface Contact {
  id: string;
  org_id: string;
  email: string;
  name: string | null;
  message: string | null;
  status: 'new' | 'contacted' | 'joined';
  source: string | null;
  user_id: string | null;
  user_display_name: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<Contact['status'], string> = {
  new: 'orange',
  contacted: 'blue',
  joined: 'green',
};

export default function MessagesPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [opened, { open, close }] = useDisclosure(false);
  const [selected, setSelected] = useState<Contact | null>(null);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/contacts?org=all&status=${statusFilter}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        // Only show contacts that have a message
        setContacts((data.contacts as Contact[]).filter((c) => c.message));
      }
    } catch (e) {
      console.error('Error loading messages:', e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      await fetch('/api/contacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, status }),
      });
      setContacts((prev) =>
        prev.map((c) => c.id === id ? { ...c, status: status as Contact['status'] } : c)
      );
      if (selected?.id === id) setSelected((s) => s ? { ...s, status: status as Contact['status'] } : s);
    } catch (e) {
      console.error('Error updating status:', e);
    } finally {
      setUpdatingId(null);
    }
  };

  const openDetail = (contact: Contact) => {
    setSelected(contact);
    open();
  };

  const filtered = contacts.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.email.toLowerCase().includes(q) ||
      (c.name?.toLowerCase().includes(q) ?? false) ||
      (c.message?.toLowerCase().includes(q) ?? false)
    );
  });

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'new', label: 'New' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'joined', label: 'Joined' },
  ];

  // Summary counts
  const newCount = contacts.filter((c) => c.status === 'new').length;

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Group gap="sm">
              <MessageSquare size={28} />
              <Title order={2}>Contact Messages</Title>
              {newCount > 0 && (
                <Badge color="orange" size="lg" variant="filled">{newCount} new</Badge>
              )}
            </Group>
            <Text c="dimmed" size="sm" mt={4}>
              Messages submitted through contact forms across all sites
            </Text>
          </div>
          <Button
            variant="light"
            leftSection={<RefreshCw size={16} />}
            onClick={loadContacts}
            loading={loading}
          >
            Refresh
          </Button>
        </Group>

        {/* Filters */}
        <Paper withBorder p="md">
          <Group>
            <Select
              value={statusFilter}
              onChange={(v) => setStatusFilter(v || 'all')}
              data={statusOptions}
              size="sm"
              w={180}
              styles={{
                input: { backgroundColor: '#fff', color: '#212529', fontWeight: 500 },
                dropdown: { backgroundColor: '#fff' },
                option: { color: '#212529', fontWeight: 500 },
              }}
            />
            <TextInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              placeholder="Search name, email, or message…"
              size="sm"
              w={320}
              leftSection={<Search size={16} />}
              styles={{ input: { backgroundColor: '#fff', color: '#212529' } }}
              rightSection={
                searchQuery && (
                  <ActionIcon size="sm" variant="subtle" onClick={() => setSearchQuery('')}>
                    <X size={14} />
                  </ActionIcon>
                )
              }
            />
            <Badge variant="light" size="lg">{filtered.length} messages</Badge>
          </Group>
        </Paper>

        {/* Table */}
        <Paper withBorder>
          {loading ? (
            <Center h={300}><Loader /></Center>
          ) : filtered.length === 0 ? (
            <Center h={200}>
              <Stack align="center" gap="xs">
                <MessageSquare size={48} color="gray" />
                <Text c="dimmed">No messages found</Text>
              </Stack>
            </Center>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>From</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Org</Table.Th>
                  <Table.Th>Message preview</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Linked user</Table.Th>
                  <Table.Th>Received</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((contact) => (
                  <Table.Tr
                    key={contact.id}
                    style={contact.status === 'new' ? { background: 'rgba(253,126,20,0.04)' } : undefined}
                  >
                    <Table.Td>
                      <Text size="sm" fw={500} c="dark">
                        {contact.name ?? <Text span size="sm" c="dimmed" fs="italic">Anonymous</Text>}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6}>
                        <Mail size={13} color="gray" />
                        <Text size="sm" c="gray.7" style={{ fontFamily: 'monospace' }}>{contact.email}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" variant="outline" color="gray">{contact.org_id}</Badge>
                    </Table.Td>
                    <Table.Td style={{ maxWidth: 280 }}>
                      <Text
                        size="sm"
                        c="gray.7"
                        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {contact.message}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="sm" color={STATUS_COLORS[contact.status]} variant="light">
                        {contact.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {contact.user_id ? (
                        <Group gap={4}>
                          <UserCheck size={13} color="green" />
                          <Text size="xs" c="green.7">
                            {contact.user_display_name || contact.user_id.slice(0, 8)}
                          </Text>
                        </Group>
                      ) : (
                        <Text size="xs" c="dimmed">—</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {new Date(contact.created_at).toLocaleDateString()}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <Tooltip label="View full message">
                          <ActionIcon variant="light" color="blue" onClick={() => openDetail(contact)}>
                            <Eye size={15} />
                          </ActionIcon>
                        </Tooltip>
                        {contact.status === 'new' && (
                          <Tooltip label="Mark as contacted">
                            <ActionIcon
                              variant="light"
                              color="teal"
                              onClick={() => updateStatus(contact.id, 'contacted')}
                              loading={updatingId === contact.id}
                            >
                              <Mail size={15} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      </Stack>

      {/* Detail Modal */}
      <Modal
        opened={opened}
        onClose={close}
        title={
          <Group gap="sm">
            <MessageSquare size={18} />
            <Text fw={600}>Message from {selected?.name ?? selected?.email}</Text>
          </Group>
        }
        size="lg"
      >
        {selected && (
          <Stack gap="md">
            <Group gap="xl">
              <Stack gap={2}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.05em' }}>From</Text>
                <Text size="sm" fw={500}>{selected.name ?? '—'}</Text>
              </Stack>
              <Stack gap={2}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.05em' }}>Email</Text>
                <Text size="sm" style={{ fontFamily: 'monospace' }}>{selected.email}</Text>
              </Stack>
              <Stack gap={2}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.05em' }}>Received</Text>
                <Text size="sm">{new Date(selected.created_at).toLocaleString()}</Text>
              </Stack>
              <Stack gap={2}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.05em' }}>Org</Text>
                <Badge size="sm" variant="outline" color="gray">{selected.org_id}</Badge>
              </Stack>
            </Group>

            <Stack gap={4}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.05em' }}>Message</Text>
              <Textarea
                value={selected.message ?? ''}
                readOnly
                autosize
                minRows={4}
                styles={{ input: { backgroundColor: '#f8f9fa', color: '#212529' } }}
              />
            </Stack>

            <Group justify="space-between" align="center">
              <Group gap="sm">
                <Text size="sm" c="dimmed">Status:</Text>
                <Badge color={STATUS_COLORS[selected.status]} variant="light">{selected.status}</Badge>
              </Group>
              <Group gap="sm">
                {selected.status !== 'contacted' && (
                  <Button
                    size="sm"
                    variant="light"
                    color="teal"
                    onClick={() => updateStatus(selected.id, 'contacted')}
                    loading={updatingId === selected.id}
                  >
                    Mark Contacted
                  </Button>
                )}
                {selected.status !== 'joined' && (
                  <Button
                    size="sm"
                    variant="light"
                    color="green"
                    onClick={() => updateStatus(selected.id, 'joined')}
                    loading={updatingId === selected.id}
                  >
                    Mark Joined
                  </Button>
                )}
                <Button size="sm" variant="subtle" component="a" href={`mailto:${selected.email}`}>
                  Reply by email
                </Button>
              </Group>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
