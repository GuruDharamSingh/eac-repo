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
  Box,
  Alert,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  Users,
  RefreshCw,
  Shield,
  UserCog,
  Search,
  X,
  Check,
  AlertCircle,
  Crown,
  Eye,
} from 'lucide-react';

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
}

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

const ROLE_OPTIONS = [
  { value: 'guide', label: 'Guide', color: 'violet', icon: Crown },
  { value: 'member', label: 'Member', color: 'blue', icon: Users },
  { value: 'viewer', label: 'Viewer', color: 'gray', icon: Eye },
];

export default function UsersPage() {
  // State
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userMemberships, setUserMemberships] = useState<UserMembership[]>([]);
  const [loadingMemberships, setLoadingMemberships] = useState(false);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [togglingAdmin, setTogglingAdmin] = useState(false);

  // Load data
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/users/by-org?org=${selectedOrg}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedOrg]);

  const loadOrganizations = async () => {
    try {
      const response = await fetch('/api/organizations', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations || []);
      }
    } catch (error) {
      console.error('Error loading organizations:', error);
    }
  };

  const loadUserMemberships = async (userId: string) => {
    setLoadingMemberships(true);
    try {
      const response = await fetch(`/api/users/${userId}/org-role`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setUserMemberships(data.memberships || []);
      }
    } catch (error) {
      console.error('Error loading user memberships:', error);
    } finally {
      setLoadingMemberships(false);
    }
  };

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Actions
  const openUserModal = async (user: User) => {
    setSelectedUser(user);
    open();
    await loadUserMemberships(user.id);
  };

  const toggleSiteAdmin = async () => {
    if (!selectedUser) return;
    setTogglingAdmin(true);
    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdmin: !selectedUser.is_admin }),
      });
      if (response.ok) {
        setSelectedUser({ ...selectedUser, is_admin: !selectedUser.is_admin });
        loadUsers();
      }
    } catch (error) {
      console.error('Error toggling admin:', error);
    } finally {
      setTogglingAdmin(false);
    }
  };

  const updateOrgRole = async (orgId: string, role: string) => {
    if (!selectedUser) return;
    setSavingRole(orgId);
    try {
      const response = await fetch(`/api/users/${selectedUser.id}/org-role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, role }),
      });
      if (response.ok) {
        await loadUserMemberships(selectedUser.id);
        loadUsers();
      }
    } catch (error) {
      console.error('Error updating org role:', error);
    } finally {
      setSavingRole(null);
    }
  };

  const removeFromOrg = async (orgId: string) => {
    if (!selectedUser) return;
    setSavingRole(orgId);
    try {
      const response = await fetch(`/api/users/${selectedUser.id}/org-role`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });
      if (response.ok) {
        await loadUserMemberships(selectedUser.id);
        loadUsers();
      }
    } catch (error) {
      console.error('Error removing from org:', error);
    } finally {
      setSavingRole(null);
    }
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(query) ||
      (user.display_name && user.display_name.toLowerCase().includes(query))
    );
  });

  // Get user's role in a specific org
  const getUserRoleInOrg = (memberships: UserMembership[], orgId: string) => {
    const membership = memberships.find(m => m.org_id === orgId);
    return membership?.role || null;
  };

  // Build org options for filter
  const orgOptions = [
    { value: 'all', label: 'All Users' },
    ...organizations.map(org => ({ value: org.id, label: org.name })),
  ];

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Group gap="sm">
              <Users size={28} />
              <Title order={2}>User Management</Title>
            </Group>
            <Text c="dimmed" size="sm" mt={4}>
              Manage user roles and permissions across organizations
            </Text>
          </div>
          <Button
            variant="light"
            leftSection={<RefreshCw size={16} />}
            onClick={loadUsers}
            loading={loading}
          >
            Refresh
          </Button>
        </Group>

        {/* Filters */}
        <Paper withBorder p="md">
          <Group>
            <Select
              value={selectedOrg}
              onChange={(value) => setSelectedOrg(value || 'all')}
              data={orgOptions}
              size="sm"
              w={250}
              placeholder="Filter by organization"
              leftSection={<Users size={16} />}
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
            <TextInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              placeholder="Search by name or email..."
              size="sm"
              w={300}
              leftSection={<Search size={16} />}
              styles={{
                input: {
                  backgroundColor: '#fff',
                  color: '#212529',
                },
              }}
              rightSection={
                searchQuery && (
                  <ActionIcon size="sm" variant="subtle" onClick={() => setSearchQuery('')}>
                    <X size={14} />
                  </ActionIcon>
                )
              }
            />
            <Badge variant="light" size="lg">
              {filteredUsers.length} users
            </Badge>
          </Group>
        </Paper>

        {/* Users Table */}
        <Paper withBorder>
          {loading ? (
            <Center h={300}>
              <Loader />
            </Center>
          ) : filteredUsers.length === 0 ? (
            <Center h={200}>
              <Stack align="center" gap="xs">
                <Users size={48} color="gray" />
                <Text c="dimmed">No users found</Text>
              </Stack>
            </Center>
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
                    <Table.Td>
                      <Text size="sm" c="gray.7" style={{ fontFamily: 'monospace' }}>
                        {user.email}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {user.is_admin && (
                          <Badge size="xs" color="red" variant="light">
                            Site Admin
                          </Badge>
                        )}
                        {user.nextcloud_synced && (
                          <Badge size="xs" color="green" variant="light">
                            NC Synced
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      {user.role && (
                        <Badge
                          size="sm"
                          color={
                            user.role === 'guide'
                              ? 'violet'
                              : user.role === 'member'
                              ? 'blue'
                              : 'gray'
                          }
                          variant="light"
                        >
                          {user.role}
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {user.organizations && user.organizations.length > 0 && (
                        <Group gap={4}>
                          {user.organizations.slice(0, 2).map((org) => (
                            <Badge key={org} size="xs" variant="outline" color="gray">
                              {org}
                            </Badge>
                          ))}
                          {user.organizations.length > 2 && (
                            <Text size="xs" c="dimmed">
                              +{user.organizations.length - 2}
                            </Text>
                          )}
                        </Group>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label="Manage roles">
                        <ActionIcon
                          variant="light"
                          color="blue"
                          onClick={() => openUserModal(user)}
                        >
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

        {/* Role Legend */}
        <Paper withBorder p="md">
          <Group gap="xl">
            <Group gap="xs">
              <Badge size="sm" color="red" variant="light">
                Site Admin
              </Badge>
              <Text size="xs" c="dimmed">
                Full access to admin dashboard
              </Text>
            </Group>
            <Group gap="xs">
              <Badge size="sm" color="violet" variant="light">
                Guide
              </Badge>
              <Text size="xs" c="dimmed">
                Can manage content & meetings
              </Text>
            </Group>
            <Group gap="xs">
              <Badge size="sm" color="blue" variant="light">
                Member
              </Badge>
              <Text size="xs" c="dimmed">
                Can participate & contribute
              </Text>
            </Group>
            <Group gap="xs">
              <Badge size="sm" color="gray" variant="light">
                Viewer
              </Badge>
              <Text size="xs" c="dimmed">
                Read-only access
              </Text>
            </Group>
          </Group>
        </Paper>
      </Stack>

      {/* User Role Modal */}
      <Modal
        opened={opened}
        onClose={close}
        title={
          <Group gap="sm">
            <UserCog size={20} />
            <Text fw={600}>Manage User Roles</Text>
          </Group>
        }
        size="lg"
      >
        {selectedUser && (
          <Stack gap="lg">
            {/* User Info */}
            <Paper withBorder p="md" bg="gray.0">
              <Group justify="space-between">
                <Group gap="md">
                  <Avatar size="lg" color={selectedUser.is_admin ? 'red' : 'blue'} radius="xl">
                    {(selectedUser.display_name || selectedUser.email)[0].toUpperCase()}
                  </Avatar>
                  <div>
                    <Text fw={600} c="dark">
                      {selectedUser.display_name || selectedUser.email.split('@')[0]}
                    </Text>
                    <Text size="sm" c="gray.7">
                      {selectedUser.email}
                    </Text>
                  </div>
                </Group>
                <Group gap="xs">
                  {selectedUser.is_admin && (
                    <Badge color="red" variant="light">
                      Site Admin
                    </Badge>
                  )}
                  {selectedUser.nextcloud_synced && (
                    <Badge color="green" variant="light">
                      NC Synced
                    </Badge>
                  )}
                </Group>
              </Group>
            </Paper>

            {/* Site Admin Toggle */}
            <Paper withBorder p="md">
              <Group justify="space-between">
                <Group gap="sm">
                  <Shield size={20} />
                  <div>
                    <Text fw={500} c="dark">Site Administrator</Text>
                    <Text size="xs" c="gray.6">
                      Full access to admin dashboard and all organizations
                    </Text>
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

            {/* Organization Roles */}
            {loadingMemberships ? (
              <Center h={100}>
                <Loader size="sm" />
              </Center>
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
                          {org.description && (
                            <Text size="xs" c="gray.6">
                              {org.description}
                            </Text>
                          )}
                        </div>
                        <Group gap="sm">
                          <Select
                            value={currentRole || ''}
                            onChange={(value) => {
                              if (value) {
                                updateOrgRole(org.id, value);
                              }
                            }}
                            data={[
                              { value: '', label: 'Not a member', disabled: true },
                              ...ROLE_OPTIONS.map((r) => ({
                                value: r.value,
                                label: r.label,
                              })),
                            ]}
                            placeholder="Select role"
                            size="xs"
                            w={130}
                            disabled={isSaving}
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
                          {currentRole && (
                            <Tooltip label="Remove from organization">
                              <ActionIcon
                                color="red"
                                variant="light"
                                size="sm"
                                onClick={() => removeFromOrg(org.id)}
                                loading={isSaving}
                              >
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

            {/* Quick Add to All */}
            <Alert variant="light" color="blue" icon={<AlertCircle size={16} />}>
              <Text size="sm">
                Select a role from the dropdown to add the user to an organization, or click the X
                to remove them.
              </Text>
            </Alert>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
