'use client';

import { useState } from 'react';
import { Group, Text, rem, Stack, Image, CloseButton, Paper, Tabs } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { IconPhoto } from '@tabler/icons-react';
import { Upload, FolderOpen } from 'lucide-react';
import { FileBrowser, type NextcloudFile } from '../nextcloud/file-browser';

export interface SingleImageFieldProps {
  label?: string;
  description?: string;
  /** Current image URL, or null/undefined if unset. */
  value?: string | null;
  onChange: (url: string | null) => void;
  /** Required for the Library tab and for tagging the upload's visibility. */
  orgId: string;
  /** Multipart upload endpoint. Defaults to the shared /api/upload route. */
  uploadEndpoint?: string;
  /** WebDAV browse endpoint for the Library tab. Defaults to /api/nextcloud. */
  libraryApiEndpoint?: string;
  /** Forwarded to the upload endpoint so the file lands in the right visibility folder. */
  visibility?: 'PUBLIC' | 'ORGANIZATION' | 'PRIVATE';
}

/**
 * A single-image equivalent of MediaUpload: upload a new file or pick an
 * existing one from the org's Nextcloud folder, resolving to one URL string
 * instead of a file list. Uploads immediately (no deferred-submit step) so
 * the field always holds a real, usable URL.
 */
export function SingleImageField({
  label,
  description,
  value,
  onChange,
  orgId,
  uploadEndpoint = '/api/upload',
  libraryApiEndpoint = '/api/nextcloud',
  visibility,
}: SingleImageFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (visibility) formData.append('visibility', visibility);
      const res = await fetch(uploadEndpoint, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Upload failed');
      onChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleLibrarySelect = (ncFile: NextcloudFile) => {
    if (ncFile.type === 'directory') return;
    onChange(`/api/media/${ncFile.filename.replace(/^\//, '')}`);
  };

  return (
    <Stack gap={4}>
      {label && <Text size="sm" fw={500}>{label}</Text>}
      {description && <Text size="xs" c="dimmed">{description}</Text>}

      {value ? (
        <Paper withBorder p="xs" radius="sm">
          <Group justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
              <Image src={value} alt="" w={60} h={60} fit="cover" radius="sm" />
              <Text size="xs" c="dimmed" lineClamp={2} style={{ wordBreak: 'break-all' }}>
                {value}
              </Text>
            </Group>
            <CloseButton onClick={() => onChange(null)} aria-label="Remove image" />
          </Group>
        </Paper>
      ) : (
        <Tabs defaultValue="upload">
          <Tabs.List>
            <Tabs.Tab value="upload" leftSection={<Upload size={14} />}>
              Upload
            </Tabs.Tab>
            <Tabs.Tab value="library" leftSection={<FolderOpen size={14} />}>
              Library
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="upload" pt="sm">
            <Dropzone
              onDrop={handleDrop}
              onReject={() => setError('File rejected — check type and size (max 25MB, images only)')}
              maxSize={25 * 1024 * 1024}
              maxFiles={1}
              accept={['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']}
              loading={uploading}
              p="xs"
            >
              <Group justify="center" gap="sm" mih={48} style={{ pointerEvents: 'none' }}>
                <IconPhoto style={{ width: rem(20), height: rem(20), color: 'var(--mantine-color-dimmed)' }} stroke={1.5} />
                <Text size="sm" c="dimmed">Drop an image or click to upload</Text>
              </Group>
            </Dropzone>
          </Tabs.Panel>

          <Tabs.Panel value="library" pt="sm">
            <FileBrowser
              orgId={orgId}
              onFileSelect={handleLibrarySelect}
              enableUpload={false}
              enableCreateFolder={false}
              apiEndpoint={libraryApiEndpoint}
            />
          </Tabs.Panel>
        </Tabs>
      )}

      {error && <Text size="xs" c="red">{error}</Text>}
    </Stack>
  );
}
