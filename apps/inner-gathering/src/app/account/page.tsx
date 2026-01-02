'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Paper,
  Stack,
  Title,
  Text,
  TextInput,
  Textarea,
  Button,
  Group,
  Badge,
  Loader,
  Center,
  Avatar,
  Alert,
  Divider,
  Box,
} from '@mantine/core';
import {
  User,
  Mail,
  Cloud,
  CloudOff,
  Shield,
  Calendar,
  Save,
  LogOut,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { signOut } from '@elkdonis/auth-client';

interface AccountData {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isAdmin: boolean;
  nextcloudSynced: boolean;
  nextcloudUserId: string | null;
  nextcloudOidcSynced: boolean;
  organizations: string[];
  roles: string[];
  title: string;
  createdAt: string;
  updatedAt: string;
}

export default function AccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [account, setAccount] = useState<AccountData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');

  useEffect(() => {
    fetchAccount();
  }, []);

  const fetchAccount = async () => {
    try {
      const response = await fetch('/api/account');
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/');
          return;
        }
        throw new Error('Failed to load account');
      }
      const data = await response.json();
      setAccount(data.user);
      setDisplayName(data.user.displayName || '');
      setBio(data.user.bio || '');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, bio }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      setSuccess('Profile updated successfully!');
      fetchAccount();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    const { error } = await signOut();
    if (!error) {
      router.push('/');
      router.refresh();
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <Container size="sm" py="xl">
        <Center py="xl">
          <Loader size="lg" />
        </Center>
      </Container>
    );
  }

  if (!account) {
    return (
      <Container size="sm" py="xl">
        <Alert icon={<AlertCircle size={16} />} color="red">
          Failed to load account. Please try logging in again.
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="sm" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={2}>Account</Title>
            <Text size="sm" c="dimmed">
              Manage your profile and settings
            </Text>
          </Stack>
          <Badge
            size="lg"
            variant="gradient"
            gradient={
              account.nextcloudSynced && account.isAdmin
                ? { from: 'indigo', to: 'violet' }
                : account.nextcloudSynced
                ? { from: 'teal', to: 'cyan' }
                : { from: 'gray', to: 'dark' }
            }
          >
            {account.title}
          </Badge>
        </Group>

        {/* Alerts */}
        {error && (
          <Alert icon={<AlertCircle size={16} />} color="red" onClose={() => setError(null)} withCloseButton>
            {error}
          </Alert>
        )}
        {success && (
          <Alert icon={<CheckCircle size={16} />} color="green" onClose={() => setSuccess(null)} withCloseButton>
            {success}
          </Alert>
        )}

        {/* Profile Card */}
        <Paper withBorder radius="lg" p="xl">
          <Stack gap="lg">
            {/* Avatar and basic info */}
            <Group>
              <Avatar
                src={account.avatarUrl}
                size={80}
                radius="xl"
                color="indigo"
              >
                {(account.displayName || account.email)[0].toUpperCase()}
              </Avatar>
              <Stack gap={4}>
                <Text size="xl" fw={600}>
                  {account.displayName || account.email.split('@')[0]}
                </Text>
                <Group gap="xs">
                  <Mail size={14} />
                  <Text size="sm" c="dimmed">
                    {account.email}
                  </Text>
                </Group>
              </Stack>
            </Group>

            <Divider />

            {/* Status badges */}
            <Group>
              {account.isAdmin && (
                <Badge leftSection={<Shield size={12} />} color="red" variant="light">
                  Admin
                </Badge>
              )}
              {account.nextcloudSynced ? (
                <Badge leftSection={<Cloud size={12} />} color="green" variant="light">
                  Nextcloud Connected
                </Badge>
              ) : (
                <Badge leftSection={<CloudOff size={12} />} color="gray" variant="light">
                  Not Connected to Nextcloud
                </Badge>
              )}
              <Badge leftSection={<Calendar size={12} />} color="blue" variant="light">
                Joined {formatDate(account.createdAt)}
              </Badge>
            </Group>

            {/* Nextcloud info for non-synced users */}
            {!account.nextcloudSynced && (
              <Alert icon={<Cloud size={16} />} color="blue" variant="light">
                <Text size="sm">
                  Your account is not yet connected to Nextcloud. Contact an administrator to enable access to shared files, documents, and video calls.
                </Text>
              </Alert>
            )}

            <Divider />

            {/* Editable fields */}
            <Stack gap="md">
              <TextInput
                label="Display Name"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.currentTarget.value)}
                leftSection={<User size={16} />}
              />

              <Textarea
                label="Bio"
                placeholder="Tell us a little about yourself..."
                value={bio}
                onChange={(e) => setBio(e.currentTarget.value)}
                minRows={3}
                maxRows={6}
              />

              <Button
                onClick={handleSave}
                loading={saving}
                leftSection={<Save size={16} />}
              >
                Save Changes
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {/* Organization memberships */}
        {account.organizations && account.organizations.length > 0 && (
          <Paper withBorder radius="lg" p="xl">
            <Stack gap="md">
              <Title order={4}>Organizations</Title>
              <Group>
                {account.organizations.map((org, index) => (
                  <Badge key={org} variant="outline" color="indigo">
                    {org} {account.roles?.[index] && `(${account.roles[index]})`}
                  </Badge>
                ))}
              </Group>
            </Stack>
          </Paper>
        )}

        {/* Account info */}
        <Paper withBorder radius="lg" p="xl">
          <Stack gap="md">
            <Title order={4}>Account Details</Title>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">User ID</Text>
                <Text size="sm" ff="monospace">{account.id.slice(0, 8)}...</Text>
              </Group>
              {account.nextcloudUserId && (
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Nextcloud ID</Text>
                  <Text size="sm" ff="monospace">{account.nextcloudUserId.slice(0, 8)}...</Text>
                </Group>
              )}
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Last Updated</Text>
                <Text size="sm">{formatDate(account.updatedAt)}</Text>
              </Group>
            </Stack>
          </Stack>
        </Paper>

        {/* Logout */}
        <Button
          variant="outline"
          color="red"
          leftSection={<LogOut size={16} />}
          onClick={handleLogout}
          fullWidth
        >
          Sign Out
        </Button>
      </Stack>
    </Container>
  );
}
