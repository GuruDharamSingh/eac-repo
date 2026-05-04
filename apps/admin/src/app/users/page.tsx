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
  Avatar,
  ActionIcon,
  Tooltip,
  Modal,
  Checkbox,
  Divider,
  TextInput,
  Alert,
  Tabs,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  Users,
  RefreshCw,
  Shield,
  UserCog,
  Search,
  X,
  AlertCircle,
  Crown,
  Eye,
  Mail,
  UserCheck,
  MessageSquare,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SignupDetails {
  interests?: string[];
  signup_at?: string;
  signup_source?: string;
}

interface User {
  id: string;
  email: string;
  display_name: string | null;
  is_admin: boolean;
  nextcloud_synced: boolean;
  nextcloud_user_id: string | null;
  created_at: string;
  role?: string;
  organizations?: string[];
  signup_details?: SignupDetails | null;
}

const INTEREST_LABELS: Record<string, string> = {
  artist_platform: "Artist looking for a platform",
  group_network: "Group / organization wanting to network",
  enthusiast_support: "Enthusiast supporting arts and mutual aid",
  volunteer: "Wants to volunteer",
  in_need: "In need of support",
  exploring: "Just exploring",
};

interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

interface UserMembership {
  org_id: string;
  role: string;
  joined_at: string;
  org_name: string;
}

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

const ROLE_OPTIONS = [
  { value: 'guide', label: 'Guide', color: 'violet', icon: Crown },
  { value: 'member', label: 'Member', color: 'blue', icon: Users },
  { value: 'viewer', label: 'Viewer', color: 'gray', icon: Eye },
];

const STATUS_COLORS: Record<Contact['status'], string> = {
  new: 'orange',
  contacted: 'blue',
  joined: 'green',
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [activeTab, setActiveTab] = useState<string>('users');

  // Shared
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data.organizations || []);
      }
    } catch (e) {
      console.error('Error loading organizations:', e);
    }
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <Group justify="space-between" align="flex-start">
          <div>
            <Group gap="sm">
              <Users size={28} />
              <Title order={2}>User Management</Title>
            </Group>
            <Text c="dimmed" size="sm" mt={4}>
              Manage members and review contact form submissions
            </Text>
          </div>
        </Group>

        <Tabs value={activeTab} onChange={(v) => setActiveTab(v ?? 'users')}>
          <Tabs.List>
            <Tabs.Tab value="users" leftSection={<Users size={15} />}>
              Users
            </Tabs.Tab>
            <Tabs.Tab value="contacts" leftSection={<UserCheck size={15} />}>
              Contacts
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="users" pt="xl">
            <UsersTab organizations={organizations} />
          </Tabs.Panel>

          <Tabs.Panel value="contacts" pt="xl">
            <ContactsTab organizations={organizations} />
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab({ organizations }: { organizations: Organization[] }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [opened, { open, close }] = useDisclosure(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userMemberships, setUserMemberships] = useState<UserMembership[]>([]);
  const [loadingMemberships, setLoadingMemberships] = useState(false);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [togglingAdmin, setTogglingAdmin] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/by-org?org=${selectedOrg}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (e) {
      console.error('Error loading users:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedOrg]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const loadUserMemberships = async (userId: string) => {
    setLoadingMemberships(true);
    try {
      const res = await fetch(`/api/users/${userId}/org-role`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUserMemberships(data.memberships || []);
      }
    } catch (e) {
      console.error('Error loading memberships:', e);
    } finally {
      setLoadingMemberships(false);
    }
  };

  const openUserModal = async (user: User) => {
    setSelectedUser(user);
    open();
    // Load memberships and full user details (incl. signup_details) in parallel
    await Promise.all([
      loadUserMemberships(user.id),
      (async () => {
        try {
          const res = await fetch(`/api/users/${user.id}`, { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            const details = data?.user?.signupDetails ?? null;
            setSelectedUser((prev) =>
              prev && prev.id === user.id ? { ...prev, signup_details: details } : prev
            );
          }
        } catch (e) {
          console.error('Error loading user details:', e);
        }
      })(),
    ]);
  };

  const toggleSiteAdmin = async () => {
    if (!selectedUser) return;
    setTogglingAdmin(true);
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdmin: !selectedUser.is_admin }),
      });
      if (res.ok) {
        setSelectedUser({ ...selectedUser, is_admin: !selectedUser.is_admin });
        loadUsers();
      }
    } catch (e) {
      console.error('Error toggling admin:', e);
    } finally {
      setTogglingAdmin(false);
    }
  };

  const updateOrgRole = async (orgId: string, role: string) => {
    if (!selectedUser) return;
    setSavingRole(orgId);
    try {
      const res = await fetch(`/api/users/${selectedUser.id}/org-role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, role }),
      });
      if (res.ok) {
        await loadUserMemberships(selectedUser.id);
        loadUsers();
      }
    } catch (e) {
      console.error('Error updating org role:', e);
    } finally {
      setSavingRole(null);
    }
  };

  const removeFromOrg = async (orgId: string) => {
    if (!selectedUser) return;
    setSavingRole(orgId);
    try {
      const res = await fetch(`/api/users/${selectedUser.id}/org-role`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });
      if (res.ok) {
        await loadUserMemberships(selectedUser.id);
        loadUsers();
      }
    } catch (e) {
      console.error('Error removing from org:', e);
    } finally {
      setSavingRole(null);
    }
  };

  const getUserRoleInOrg = (memberships: UserMembership[], orgId: string) =>
    memberships.find((m) => m.org_id === orgId)?.role ?? null;

  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return u.email.toLowerCase().includes(q) || (u.display_name?.toLowerCase().includes(q) ?? false);
  });

  const orgOptions = [
    { value: 'all', label: 'All Users' },
    ...organizations.map((o) => ({ value: o.id, label: o.name })),
  ];

  return (
    <Stack gap="lg">
      {/* Filters */}
      <Paper withBorder p="md">
        <Group>
          <Select
            value={selectedOrg}
            onChange={(v) => setSelectedOrg(v || 'all')}
            data={orgOptions}
            size="sm"
            w={250}
            placeholder="Filter by organization"
            leftSection={<Users size={16} />}
            styles={{ input: { backgroundColor: '#fff', color: '#212529', fontWeight: 500 }, dropdown: { backgroundColor: '#fff' }, option: { color: '#212529', fontWeight: 500 } }}
          />
          <TextInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            placeholder="Search by name or email…"
            size="sm"
            w={300}
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
          <Badge variant="light" size="lg">{filteredUsers.length} users</Badge>
          <Button variant="light" leftSection={<RefreshCw size={16} />} onClick={loadUsers} loading={loading} ml="auto">
            Refresh
          </Button>
        </Group>
      </Paper>

      {/* Table */}
      <Paper withBorder>
        {loading ? (
          <Center h={300}><Loader /></Center>
        ) : filteredUsers.length === 0 ? (
          <Center h={200}><Stack align="center" gap="xs"><Users size={48} color="gray" /><Text c="dimmed">No users found</Text></Stack></Center>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>User</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Organizations</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredUsers.map((user) => (
                <Table.Tr key={user.id}>
                  <Table.Td>
                    <Group gap="sm">
                      <Avatar size="sm" color={user.is_admin ? 'red' : 'blue'} radius="xl">
                        {(user.display_name || user.email)[0].toUpperCase()}
                      </Avatar>
                      <Text size="sm" fw={500} c="dark">
                        {user.display_name || user.email.split('@')[0]}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td><Text size="sm" c="gray.7" style={{ fontFamily: 'monospace' }}>{user.email}</Text></Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {user.is_admin && <Badge size="xs" color="red" variant="light">Site Admin</Badge>}
                      {user.nextcloud_synced && <Badge size="xs" color="green" variant="light">NC Synced</Badge>}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    {user.role && (
                      <Badge size="sm" color={user.role === 'guide' ? 'violet' : user.role === 'member' ? 'blue' : 'gray'} variant="light">
                        {user.role}
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {user.organizations && user.organizations.length > 0 && (
                      <Group gap={4}>
                        {user.organizations.slice(0, 2).map((org) => (
                          <Badge key={org} size="xs" variant="outline" color="gray">{org}</Badge>
                        ))}
                        {user.organizations.length > 2 && <Text size="xs" c="dimmed">+{user.organizations.length - 2}</Text>}
                      </Group>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Tooltip label="Manage roles">
                      <ActionIcon variant="light" color="blue" onClick={() => openUserModal(user)}>
                        <UserCog size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* Legend */}
      <Paper withBorder p="md">
        <Group gap="xl">
          {[
            { color: 'red', label: 'Site Admin', desc: 'Full access to admin dashboard' },
            { color: 'violet', label: 'Guide', desc: 'Can manage content & meetings' },
            { color: 'blue', label: 'Member', desc: 'Can participate & contribute' },
            { color: 'gray', label: 'Viewer', desc: 'Read-only access' },
          ].map(({ color, label, desc }) => (
            <Group key={label} gap="xs">
              <Badge size="sm" color={color} variant="light">{label}</Badge>
              <Text size="xs" c="dimmed">{desc}</Text>
            </Group>
          ))}
        </Group>
      </Paper>

      {/* Role Modal */}
      <Modal
        opened={opened}
        onClose={close}
        title={<Group gap="sm"><UserCog size={20} /><Text fw={600}>Manage User Roles</Text></Group>}
        size="lg"
      >
        {selectedUser && (
          <Stack gap="lg">
            <Paper withBorder p="md" bg="gray.0">
              <Group justify="space-between">
                <Group gap="md">
                  <Avatar size="lg" color={selectedUser.is_admin ? 'red' : 'blue'} radius="xl">
                    {(selectedUser.display_name || selectedUser.email)[0].toUpperCase()}
                  </Avatar>
                  <div>
                    <Text fw={600} c="dark">{selectedUser.display_name || selectedUser.email.split('@')[0]}</Text>
                    <Text size="sm" c="gray.7">{selectedUser.email}</Text>
                  </div>
                </Group>
                <Group gap="xs">
                  {selectedUser.is_admin && <Badge color="red" variant="light">Site Admin</Badge>}
                  {selectedUser.nextcloud_synced && <Badge color="green" variant="light">NC Synced</Badge>}
                </Group>
              </Group>
            </Paper>

            {selectedUser.signup_details && (
              <Paper withBorder p="md">
                <Stack gap="sm">
                  <Group gap="sm">
                    <UserCheck size={18} />
                    <Text fw={600} c="dark">Signup Details</Text>
                  </Group>
                  {selectedUser.signup_details.interests && selectedUser.signup_details.interests.length > 0 && (
                    <Stack gap={4}>
                      <Text size="xs" c="gray.7" fw={500}>What brings them here</Text>
                      <Group gap="xs">
                        {selectedUser.signup_details.interests.map((key) => (
                          <Badge key={key} color="blue" variant="light" size="md">
                            {INTEREST_LABELS[key] ?? key}
                          </Badge>
                        ))}
                      </Group>
                    </Stack>
                  )}
                  {selectedUser.signup_details.signup_source && (
                    <Group gap="xs">
                      <Text size="xs" c="gray.7" fw={500}>Source:</Text>
                      <Text size="xs" c="dark">{selectedUser.signup_details.signup_source}</Text>
                    </Group>
                  )}
                  {selectedUser.signup_details.signup_at && (
                    <Group gap="xs">
                      <Text size="xs" c="gray.7" fw={500}>Signed up:</Text>
                      <Text size="xs" c="dark">
                        {new Date(selectedUser.signup_details.signup_at).toLocaleString()}
                      </Text>
                    </Group>
                  )}
                </Stack>
              </Paper>
            )}

            <Paper withBorder p="md">
              <Group justify="space-between">
                <Group gap="sm">
                  <Shield size={20} />
                  <div>
                    <Text fw={500} c="dark">Site Administrator</Text>
                    <Text size="xs" c="gray.6">Full access to admin dashboard and all organizations</Text>
                  </div>
                </Group>
                <Checkbox
                  checked={selectedUser.is_admin}
                  onChange={toggleSiteAdmin}
                  disabled={togglingAdmin}
                  label={selectedUser.is_admin ? 'Enabled' : 'Disabled'}
                />
              </Group>
            </Paper>

            <Divider label="Organization Roles" labelPosition="center" />

            {loadingMemberships ? (
              <Center h={100}><Loader size="sm" /></Center>
            ) : (
              <Stack gap="sm">
                {organizations.map((org) => {
                  const currentRole = getUserRoleInOrg(userMemberships, org.id);
                  const isSaving = savingRole === org.id;
                  return (
                    <Paper key={org.id} withBorder p="md">
                      <Group justify="space-between">
                        <div>
                          <Text fw={500} c="dark">{org.name}</Text>
                          {org.description && <Text size="xs" c="gray.6">{org.description}</Text>}
                        </div>
                        <Group gap="sm">
                          <Select
                            value={currentRole || ''}
                            onChange={(v) => { if (v) updateOrgRole(org.id, v); }}
                            data={[
                              { value: '', label: 'Not a member', disabled: true },
                              ...ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label })),
                            ]}
                            placeholder="Select role"
                            size="xs"
                            w={130}
                            disabled={isSaving}
                            styles={{ input: { backgroundColor: '#fff', color: '#212529', fontWeight: 500 }, dropdown: { backgroundColor: '#fff' }, option: { color: '#212529', fontWeight: 500 } }}
                          />
                          {currentRole && (
                            <Tooltip label="Remove from organization">
                              <ActionIcon color="red" variant="light" size="sm" onClick={() => removeFromOrg(org.id)} loading={isSaving}>
                                <X size={14} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                          {isSaving && <Loader size="xs" />}
                        </Group>
                      </Group>
                    </Paper>
                  );
                })}
              </Stack>
            )}

            <Alert variant="light" color="blue" icon={<AlertCircle size={16} />}>
              <Text size="sm">Select a role to add the user to an organization, or click X to remove them.</Text>
            </Alert>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

// ─── Contacts Tab ─────────────────────────────────────────────────────────────

function ContactsTab({ organizations }: { organizations: Organization[] }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/contacts?org=${selectedOrg}&status=${statusFilter}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
      }
    } catch (e) {
      console.error('Error loading contacts:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedOrg, statusFilter]);

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
      setContacts((prev) => prev.map((c) => c.id === id ? { ...c, status: status as Contact['status'] } : c));
    } catch (e) {
      console.error('Error updating contact:', e);
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = contacts.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.email.toLowerCase().includes(q) ||
      (c.name?.toLowerCase().includes(q) ?? false)
    );
  });

  const orgOptions = [
    { value: 'all', label: 'All Orgs' },
    ...organizations.map((o) => ({ value: o.id, label: o.name })),
  ];

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'new', label: 'New' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'joined', label: 'Joined' },
  ];

  return (
    <Stack gap="lg">
      {/* Filters */}
      <Paper withBorder p="md">
        <Group>
          <Select
            value={selectedOrg}
            onChange={(v) => setSelectedOrg(v || 'all')}
            data={orgOptions}
            size="sm"
            w={220}
            leftSection={<Users size={16} />}
            styles={{ input: { backgroundColor: '#fff', color: '#212529', fontWeight: 500 }, dropdown: { backgroundColor: '#fff' }, option: { color: '#212529', fontWeight: 500 } }}
          />
          <Select
            value={statusFilter}
            onChange={(v) => setStatusFilter(v || 'all')}
            data={statusOptions}
            size="sm"
            w={160}
            styles={{ input: { backgroundColor: '#fff', color: '#212529', fontWeight: 500 }, dropdown: { backgroundColor: '#fff' }, option: { color: '#212529', fontWeight: 500 } }}
          />
          <TextInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            placeholder="Search name or email…"
            size="sm"
            w={260}
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
          <Badge variant="light" size="lg">{filtered.length} contacts</Badge>
          <Button variant="light" leftSection={<RefreshCw size={16} />} onClick={loadContacts} loading={loading} ml="auto">
            Refresh
          </Button>
        </Group>
      </Paper>

      {/* Table */}
      <Paper withBorder>
        {loading ? (
          <Center h={300}><Loader /></Center>
        ) : filtered.length === 0 ? (
          <Center h={200}>
            <Stack align="center" gap="xs">
              <Mail size={48} color="gray" />
              <Text c="dimmed">No contacts found</Text>
            </Stack>
          </Center>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Org</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Linked User</Table.Th>
                <Table.Th>Message</Table.Th>
                <Table.Th>Received</Table.Th>
                <Table.Th>Update Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((contact) => (
                <Table.Tr key={contact.id}>
                  <Table.Td>
                    <Text size="sm" fw={500} c="dark">
                      {contact.name || <Text span size="sm" c="dimmed" fs="italic">—</Text>}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={6}>
                      <Mail size={14} color="gray" />
                      <Text size="sm" c="gray.7" style={{ fontFamily: 'monospace' }}>{contact.email}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" variant="outline" color="gray">{contact.org_id}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" color={STATUS_COLORS[contact.status]} variant="light">
                      {contact.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {contact.user_id ? (
                      <Group gap={4}>
                        <UserCheck size={14} color="green" />
                        <Text size="xs" c="green.7">{contact.user_display_name || 'User #' + contact.user_id.slice(0, 8)}</Text>
                      </Group>
                    ) : (
                      <Text size="xs" c="dimmed">—</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {contact.message ? (
                      <Tooltip label={contact.message} multiline w={300} position="top">
                        <Group gap={4} style={{ cursor: 'help' }}>
                          <MessageSquare size={14} color="gray" />
                          <Text size="xs" c="dimmed" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {contact.message}
                          </Text>
                        </Group>
                      </Tooltip>
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
                    <Select
                      value={contact.status}
                      onChange={(v) => { if (v) updateStatus(contact.id, v); }}
                      data={[
                        { value: 'new', label: 'New' },
                        { value: 'contacted', label: 'Contacted' },
                        { value: 'joined', label: 'Joined' },
                      ]}
                      size="xs"
                      w={120}
                      disabled={updatingId === contact.id}
                      styles={{ input: { backgroundColor: '#fff', color: '#212529', fontWeight: 500 }, dropdown: { backgroundColor: '#fff' }, option: { color: '#212529', fontWeight: 500 } }}
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
}
