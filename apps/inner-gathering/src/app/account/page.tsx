'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ColorInput,
  Container,
  Paper,
  Stack,
  Title,
  Text,
  TextInput,
  Button,
  Group,
  Badge,
  Loader,
  Center,
  Avatar,
  Alert,
  Divider,
  PasswordInput,
  MultiSelect,
  Anchor,
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
  Lock,
  Trash2,
  BookOpen,
  ExternalLink,
} from 'lucide-react';
import { signOut } from '@elkdonis/auth-client';

const DISCIPLINE_OPTIONS = [
  { value: 'visual-art', label: 'Visual Art' },
  { value: 'music', label: 'Music' },
  { value: 'writing', label: 'Writing' },
  { value: 'dance', label: 'Dance / Movement' },
  { value: 'yoga', label: 'Yoga / Somatic' },
  { value: 'healing', label: 'Healing Arts' },
  { value: 'ceramics', label: 'Ceramics / Craft' },
  { value: 'textile', label: 'Textile / Fibre' },
  { value: 'film', label: 'Film / Video' },
  { value: 'photography', label: 'Photography' },
  { value: 'theatre', label: 'Theatre / Performance' },
  { value: 'sound', label: 'Sound / Audio' },
  { value: 'design', label: 'Graphic / Web Design' },
  { value: 'culinary', label: 'Culinary Arts' },
  { value: 'other', label: 'Other' },
];

interface AccountData {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  commentColor: string | null;
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

interface ArtistProfile {
  user_id: string;
  display_name: string | null;
  city: string | null;
  bio: string | null;
  disciplines: string[];
  portfolio_url: string | null;
  is_stub: boolean;
}

export default function AccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [account, setAccount] = useState<AccountData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Artist directory form state
  const [artistProfile, setArtistProfile] = useState<ArtistProfile | null>(null);
  const [artCity, setArtCity] = useState('');
  const [artDisciplines, setArtDisciplines] = useState<string[]>([]);
  const [artPortfolio, setArtPortfolio] = useState('');
  const [artSaving, setArtSaving] = useState(false);
  const [artSuccess, setArtSuccess] = useState<string | null>(null);
  const [artError, setArtError] = useState<string | null>(null);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [commentColor, setCommentColor] = useState('');

  // Blog password management state
  const [managedOrgs, setManagedOrgs] = useState<Array<{
    orgId: string;
    orgName: string;
    hasPassword: boolean;
  }>>([]);
  const [blogPasswordInputs, setBlogPasswordInputs] = useState<Record<string, string>>({});
  const [blogPasswordSaving, setBlogPasswordSaving] = useState<Record<string, boolean>>({});
  const [blogPasswordSuccess, setBlogPasswordSuccess] = useState<Record<string, string>>({});
  const [blogPasswordError, setBlogPasswordError] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchAccount();
    fetchArtistProfile();
  }, []);

  const fetchArtistProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      if (!res.ok) return;
      const data = await res.json();
      if (data.profile) {
        setArtistProfile(data.profile);
        setArtCity(data.profile.city ?? '');
        setArtDisciplines(data.profile.disciplines ?? []);
        setArtPortfolio(data.profile.portfolio_url ?? '');
      }
    } catch { /* soft fail */ }
  };

  const handleSaveArtistProfile = async () => {
    setArtSaving(true);
    setArtError(null);
    setArtSuccess(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName || undefined,
          city: artCity || undefined,
          disciplines: artDisciplines,
          portfolioUrl: artPortfolio || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Save failed');
      }
      setArtSuccess('Artist profile updated!');
      fetchArtistProfile();
    } catch (err: any) {
      setArtError(err.message);
    } finally {
      setArtSaving(false);
    }
  };

  // Fetch managed orgs for blog password management
  useEffect(() => {
    if (!account) return;

    const fetchManagedOrgs = async () => {
      const orgs: typeof managedOrgs = [];
      for (let i = 0; i < (account.organizations?.length || 0); i++) {
        const orgId = account.organizations[i];
        const role = account.roles?.[i];
        // Only show for owner/guide/admin
        if (role === 'owner' || role === 'guide' || account.isAdmin) {
          try {
            const res = await fetch(`/api/org/${orgId}/blog-password`);
            if (res.ok) {
              const data = await res.json();
              orgs.push({
                orgId: data.orgId,
                orgName: data.orgName,
                hasPassword: data.hasPassword,
              });
            }
          } catch { /* ignore */ }
        }
      }
      // Also check for admin access to all orgs
      if (account.isAdmin) {
        const allOrgIds = ['inner_group', 'elkdonis', 'sunjay', 'guru-dharam'];
        for (const oid of allOrgIds) {
          if (!orgs.find((o) => o.orgId === oid)) {
            try {
              const res = await fetch(`/api/org/${oid}/blog-password`);
              if (res.ok) {
                const data = await res.json();
                if (data.isOwnerOrGuide) {
                  orgs.push({
                    orgId: data.orgId,
                    orgName: data.orgName,
                    hasPassword: data.hasPassword,
                  });
                }
              }
            } catch { /* ignore */ }
          }
        }
      }
      setManagedOrgs(orgs);
    };

    fetchManagedOrgs();
  }, [account]);

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
      setCommentColor(data.user.commentColor || '');
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
        body: JSON.stringify({ displayName, commentColor: commentColor || undefined }),
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

  const handleSetBlogPassword = async (orgId: string) => {
    const password = blogPasswordInputs[orgId];
    if (!password || password.length < 4) {
      setBlogPasswordError((prev) => ({ ...prev, [orgId]: 'Password must be at least 4 characters' }));
      return;
    }

    setBlogPasswordSaving((prev) => ({ ...prev, [orgId]: true }));
    setBlogPasswordError((prev) => ({ ...prev, [orgId]: '' }));
    setBlogPasswordSuccess((prev) => ({ ...prev, [orgId]: '' }));

    try {
      const res = await fetch(`/api/org/${orgId}/blog-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to set password');
      }

      setBlogPasswordSuccess((prev) => ({ ...prev, [orgId]: 'Blog password updated!' }));
      setBlogPasswordInputs((prev) => ({ ...prev, [orgId]: '' }));
      setManagedOrgs((prev) =>
        prev.map((o) => (o.orgId === orgId ? { ...o, hasPassword: true } : o))
      );
    } catch (err: any) {
      setBlogPasswordError((prev) => ({ ...prev, [orgId]: err.message }));
    } finally {
      setBlogPasswordSaving((prev) => ({ ...prev, [orgId]: false }));
    }
  };

  const handleRemoveBlogPassword = async (orgId: string) => {
    setBlogPasswordSaving((prev) => ({ ...prev, [orgId]: true }));
    setBlogPasswordError((prev) => ({ ...prev, [orgId]: '' }));
    setBlogPasswordSuccess((prev) => ({ ...prev, [orgId]: '' }));

    try {
      const res = await fetch(`/api/org/${orgId}/blog-password`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove password');
      }

      setBlogPasswordSuccess((prev) => ({ ...prev, [orgId]: 'Blog password removed. Anyone can now post.' }));
      setManagedOrgs((prev) =>
        prev.map((o) => (o.orgId === orgId ? { ...o, hasPassword: false } : o))
      );
    } catch (err: any) {
      setBlogPasswordError((prev) => ({ ...prev, [orgId]: err.message }));
    } finally {
      setBlogPasswordSaving((prev) => ({ ...prev, [orgId]: false }));
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
            <Group justify="space-between" align="flex-start">
              <Group>
                <Avatar src={account.avatarUrl} size={80} radius="xl" color="indigo">
                  {(account.displayName || account.email)[0].toUpperCase()}
                </Avatar>
                <Stack gap={4}>
                  <Text size="xl" fw={600}>
                    {account.displayName || account.email.split('@')[0]}
                  </Text>
                  <Group gap="xs">
                    <Mail size={14} />
                    <Text size="sm" c="dimmed">{account.email}</Text>
                  </Group>
                </Stack>
              </Group>
              <Anchor href="/profile" size="sm" c="dimmed">
                <Group gap={4}>
                  Edit profile & photo
                  <ExternalLink size={12} />
                </Group>
              </Anchor>
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

              <ColorInput
                label="Comment Color"
                description="Choose a color for your name in comments"
                placeholder="Default"
                value={commentColor}
                onChange={setCommentColor}
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

        {/* Artist Directory */}
        <Paper withBorder radius="lg" p="xl">
          <Stack gap="lg">
            <Stack gap={4}>
              <Group gap="xs">
                <BookOpen size={18} />
                <Title order={4}>Artist Directory</Title>
                {artistProfile && !artistProfile.is_stub && (
                  <Badge size="sm" color="green" variant="light">Listed</Badge>
                )}
                {artistProfile?.is_stub && (
                  <Badge size="sm" color="yellow" variant="light">Stub — fill in to appear</Badge>
                )}
              </Group>
              <Text size="sm" c="dimmed">
                Your entry in the public Elkdonis artist directory. Fill in at least your city
                and one discipline to appear.{' '}
                <Anchor size="sm" href="http://localhost:3007/artists" target="_blank">
                  View directory →
                </Anchor>
              </Text>
            </Stack>

            {artError && (
              <Alert icon={<AlertCircle size={14} />} color="red" variant="light" py="xs"
                onClose={() => setArtError(null)} withCloseButton>
                {artError}
              </Alert>
            )}
            {artSuccess && (
              <Alert icon={<CheckCircle size={14} />} color="green" variant="light" py="xs"
                onClose={() => setArtSuccess(null)} withCloseButton>
                {artSuccess}
              </Alert>
            )}

            <TextInput
              label="City / Location"
              placeholder="Toronto, ON"
              value={artCity}
              onChange={(e) => setArtCity(e.currentTarget.value)}
            />

            <MultiSelect
              label="Disciplines"
              placeholder="Select what you make or practice"
              data={DISCIPLINE_OPTIONS}
              value={artDisciplines}
              onChange={setArtDisciplines}
              searchable
              clearable
              maxValues={6}
            />

            <TextInput
              label="Portfolio URL"
              placeholder="https://yoursite.com"
              value={artPortfolio}
              onChange={(e) => setArtPortfolio(e.currentTarget.value)}
            />

            <Button
              onClick={handleSaveArtistProfile}
              loading={artSaving}
              leftSection={<Save size={16} />}
              variant="light"
            >
              Save to Directory
            </Button>
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

        {/* Blog Password Management — for owners/guides/admins */}
        {managedOrgs.length > 0 && (
          <Paper withBorder radius="lg" p="xl">
            <Stack gap="lg">
              <Stack gap={4}>
                <Title order={4}>Blog Passwords</Title>
                <Text size="sm" c="dimmed">
                  Set a password that other users need to publish content to your organization.
                  Members without owner/guide access will be prompted for this password.
                </Text>
              </Stack>

              {managedOrgs.map((org) => (
                <Paper key={org.orgId} withBorder radius="md" p="md" bg="gray.0">
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Group gap="xs">
                        <Lock size={16} />
                        <Text fw={600} size="sm">{org.orgName}</Text>
                      </Group>
                      <Badge
                        variant="light"
                        color={org.hasPassword ? 'green' : 'gray'}
                        size="sm"
                      >
                        {org.hasPassword ? 'Password Set' : 'No Password'}
                      </Badge>
                    </Group>

                    {blogPasswordSuccess[org.orgId] && (
                      <Alert icon={<CheckCircle size={14} />} color="green" variant="light" py="xs">
                        <Text size="sm">{blogPasswordSuccess[org.orgId]}</Text>
                      </Alert>
                    )}
                    {blogPasswordError[org.orgId] && (
                      <Alert icon={<AlertCircle size={14} />} color="red" variant="light" py="xs">
                        <Text size="sm">{blogPasswordError[org.orgId]}</Text>
                      </Alert>
                    )}

                    <Group gap="xs" align="flex-end">
                      <PasswordInput
                        placeholder={org.hasPassword ? 'Enter new password to update' : 'Set a blog password'}
                        value={blogPasswordInputs[org.orgId] || ''}
                        onChange={(e) =>
                          setBlogPasswordInputs((prev) => ({
                            ...prev,
                            [org.orgId]: e.currentTarget.value,
                          }))
                        }
                        style={{ flex: 1 }}
                        size="sm"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSetBlogPassword(org.orgId)}
                        loading={blogPasswordSaving[org.orgId]}
                        leftSection={<Save size={14} />}
                      >
                        {org.hasPassword ? 'Update' : 'Set Password'}
                      </Button>
                      {org.hasPassword && (
                        <Button
                          size="sm"
                          variant="light"
                          color="red"
                          onClick={() => handleRemoveBlogPassword(org.orgId)}
                          loading={blogPasswordSaving[org.orgId]}
                          leftSection={<Trash2 size={14} />}
                        >
                          Remove
                        </Button>
                      )}
                    </Group>
                  </Stack>
                </Paper>
              ))}
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
