'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Avatar,
  Box,
  Button,
  FileButton,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
  Title,
  ActionIcon,
  Loader,
  Badge,
} from '@mantine/core';
import { Camera, Check, Link as LinkIcon, Plus, Trash2, User } from 'lucide-react';
import { RichTextEditor } from '@elkdonis/ui';
import { notifications } from '@mantine/notifications';

// ─── 4 blues + gold ───────────────────────────────────────────────────────────
// #5278bd  modal body bg (lightest)
// #104b8C  avatar strip bg
// #063179  modal header bg
// #022278  input bg (darkest, highest contrast)
// #b79a55  gold border/trim

interface SocialLink { label: string; url: string }
interface ProfileState {
  displayName: string;
  photoUrl: string;
  personalPhilosophy: string;
  portfolioUrl: string;
  socialLinks: SocialLink[];
}

const EMPTY: ProfileState = {
  displayName: '', photoUrl: '', personalPhilosophy: '', portfolioUrl: '', socialLinks: [],
};

const INPUT = {
  input: { background: '#022278', border: '1px solid #b79a55', color: '#f0c98a' },
};

const LABEL: React.CSSProperties = {
  color: '#f0c98a',
  fontFamily: "'Cinzel', serif",
  letterSpacing: '0.1em',
  fontSize: 11,
  textTransform: 'uppercase',
  fontWeight: 700,
  marginBottom: 6,
  display: 'block',
};

interface ProfileModalProps {
  opened: boolean;
  onClose: () => void;
}

export function ProfileModal({ opened, onClose }: ProfileModalProps) {
  const [form, setForm] = useState<ProfileState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestForm = useRef(form);
  useEffect(() => { latestForm.current = form; }, [form]);

  // Load profile when modal opens
  useEffect(() => {
    if (!opened) return;
    setLoading(true);
    fetch('/api/profile')
      .then(r => r.json())
      .then(({ profile }) => {
        if (profile) setForm({
          displayName: profile.display_name ?? '',
          photoUrl: profile.photo_url ?? '',
          personalPhilosophy: profile.personal_philosophy ?? '',
          portfolioUrl: profile.portfolio_url ?? '',
          socialLinks: Array.isArray(profile.social_links) ? profile.social_links : [],
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [opened]);

  const persist = useCallback(async (data: ProfileState) => {
    setSaving(true); setSaved(false);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: data.displayName || undefined,
          photoUrl: data.photoUrl || undefined,
          personalPhilosophy: data.personalPhilosophy || undefined,
          portfolioUrl: data.portfolioUrl || undefined,
          socialLinks: data.socialLinks,
        }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      notifications.show({ color: 'red', title: 'Could not save', message: 'Please try again.' });
    } finally { setSaving(false); }
  }, []);

  const scheduleSave = useCallback((next: ProfileState) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(next), 1200);
  }, [persist]);

  const update = useCallback(<K extends keyof ProfileState>(key: K, value: ProfileState[K]) => {
    setForm(prev => { const next = { ...prev, [key]: value }; scheduleSave(next); return next; });
  }, [scheduleSave]);

  const handleAvatarUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      setForm(prev => { const next = { ...prev, photoUrl: url }; persist(next); return next; });
    } catch {
      notifications.show({ color: 'red', title: 'Upload failed', message: 'Please try again.' });
    } finally { setUploading(false); }
  };

  const addLink = () => {
    const next = { ...latestForm.current, socialLinks: [...latestForm.current.socialLinks, { label: '', url: '' }] };
    setForm(next); scheduleSave(next);
  };

  const updateLink = (i: number, field: keyof SocialLink, value: string) => {
    setForm(prev => {
      const links = prev.socialLinks.map((l, idx) => idx === i ? { ...l, [field]: value } : l);
      const next = { ...prev, socialLinks: links };
      scheduleSave(next);
      return next;
    });
  };

  const removeLink = (i: number) => {
    setForm(prev => {
      const links = prev.socialLinks.filter((_, idx) => idx !== i);
      const next = { ...prev, socialLinks: links };
      scheduleSave(next);
      return next;
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size={480}
      padding={0}
      withCloseButton={false}
      overlayProps={{ blur: 4, backgroundOpacity: 0.75 }}
      styles={{
        content: {
          background: '#5278bd',
          border: '2px solid #b79a55',
          borderRadius: 10,
          overflow: 'hidden',
        },
        overlay: { background: 'rgba(2, 10, 47, 0.82)' },
      }}
    >
      {/* Header — #063179 */}
      <Box style={{ background: '#063179', borderBottom: '2px solid #b79a55', padding: '13px 20px' }}>
        <Group justify="space-between">
          <Group gap="sm">
            <Title
              order={5}
              style={{ color: '#b79a55', fontFamily: "'Cinzel', serif", letterSpacing: '0.14em', textTransform: 'uppercase' }}
            >
              Your Profile
            </Title>
            {saving && <Loader size="xs" color="yellow" />}
            {saved && (
              <Badge size="xs" variant="filled" style={{ background: '#b79a55', color: '#020a2f' }} leftSection={<Check size={9} />}>
                Saved
              </Badge>
            )}
          </Group>
          <ActionIcon variant="subtle" style={{ color: '#b79a55' }} onClick={onClose}>
            ×
          </ActionIcon>
        </Group>
      </Box>

      {loading ? (
        <Box p="xl" style={{ display: 'flex', justifyContent: 'center' }}>
          <Loader color="yellow" />
        </Box>
      ) : (
        <Stack gap={0}>
          {/* Avatar strip — #104b8C */}
          <Box style={{ background: '#104b8C', borderBottom: '1px solid #063179', padding: '16px 24px' }}>
            <Group gap="md" align="center">
              <Box style={{ position: 'relative', flexShrink: 0 }}>
                <Avatar src={form.photoUrl || null} size={68} radius={68} style={{ border: '2px solid #b79a55' }}>
                  <User size={30} color="#b79a55" />
                </Avatar>
                {uploading && (
                  <Box style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Loader size="xs" color="yellow" />
                  </Box>
                )}
              </Box>
              <Stack gap={6}>
                <Text size="xs" style={{ color: '#dce6ff' }}>
                  Photo used everywhere — feed, comments, directory.
                </Text>
                <FileButton onChange={handleAvatarUpload} accept="image/*">
                  {(props) => (
                    <Button
                      {...props}
                      size="xs"
                      variant="outline"
                      style={{ borderColor: '#b79a55', color: '#b79a55', alignSelf: 'flex-start' }}
                      leftSection={<Camera size={12} />}
                      disabled={uploading}
                    >
                      {form.photoUrl ? 'Change' : 'Add photo'}
                    </Button>
                  )}
                </FileButton>
              </Stack>
            </Group>
          </Box>

          {/* Fields — #5278bd body */}
          <Stack gap="lg" p="xl">
            {/* Name */}
            <Box>
              <span style={LABEL}>Name</span>
              <TextInput
                placeholder="How you'd like to be known"
                value={form.displayName}
                onChange={(e) => update('displayName', e.currentTarget.value)}
                styles={INPUT}
              />
            </Box>

            {/* Statement */}
            <Box>
              <span style={LABEL}>Statement</span>
              <Box style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid #b79a55' }}>
                <RichTextEditor
                  content={form.personalPhilosophy}
                  onChange={(v) => update('personalPhilosophy', v)}
                  placeholder="Your practice, what you make, what moves you…"
                  minimal
                />
              </Box>
            </Box>

            {/* Links */}
            <Box>
              <span style={LABEL}>Links</span>
              <Stack gap="xs">
                <TextInput
                  placeholder="Primary website or portfolio"
                  value={form.portfolioUrl}
                  onChange={(e) => update('portfolioUrl', e.currentTarget.value)}
                  leftSection={<LinkIcon size={13} color="#b79a55" />}
                  styles={INPUT}
                />
                {form.socialLinks.map((link, i) => (
                  <Group key={i} gap="xs" align="center">
                    <TextInput
                      placeholder="Label"
                      value={link.label}
                      onChange={(e) => updateLink(i, 'label', e.currentTarget.value)}
                      style={{ flex: '0 0 110px' }}
                      styles={INPUT}
                    />
                    <TextInput
                      placeholder="URL"
                      value={link.url}
                      onChange={(e) => updateLink(i, 'url', e.currentTarget.value)}
                      style={{ flex: 1 }}
                      styles={INPUT}
                    />
                    <ActionIcon variant="subtle" color="red" onClick={() => removeLink(i)}>
                      <Trash2 size={14} />
                    </ActionIcon>
                  </Group>
                ))}
                <Button
                  size="xs"
                  variant="subtle"
                  style={{ color: '#b79a55', alignSelf: 'flex-start', paddingLeft: 0 }}
                  leftSection={<Plus size={13} />}
                  onClick={addLink}
                >
                  Add link
                </Button>
              </Stack>
            </Box>
          </Stack>
        </Stack>
      )}
    </Modal>
  );
}
