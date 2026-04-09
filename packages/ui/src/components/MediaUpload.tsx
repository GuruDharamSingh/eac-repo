'use client';

import { Group, Text, rem, Stack, Image, CloseButton, Paper, ThemeIcon, Tabs, Badge } from '@mantine/core';
import { Dropzone, FileWithPath } from '@mantine/dropzone';
import { IconUpload, IconPhoto, IconX, IconVideo, IconFileMusic, IconFileText } from '@tabler/icons-react';
import { useState } from 'react';
import { Upload, FolderOpen } from 'lucide-react';
import { FileBrowser, type NextcloudFile } from '../nextcloud/file-browser';

export interface SelectedNextcloudFile {
  filename: string;
  basename: string;
  size: number;
  mime?: string;
  url: string;
}

export interface MediaUploadProps {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number; // in MB
  /** Enable the Nextcloud library tab. Requires orgId. */
  enableLibrary?: boolean;
  orgId?: string;
  /** Already-selected Nextcloud files */
  selectedFiles?: SelectedNextcloudFile[];
  /** Called when a Nextcloud file is selected from the library */
  onSelectFile?: (file: SelectedNextcloudFile) => void;
  /** Called when a selected Nextcloud file is removed */
  onRemoveSelectedFile?: (index: number) => void;
  /** API endpoint for file browser (defaults to /api/nextcloud) */
  libraryApiEndpoint?: string;
}

const ACCEPTED_TYPES = [
  'image/*',
  'audio/*',
  'video/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip',
];

const getFileKey = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;

const getIconForFile = (file: File) => {
  if (file.type.startsWith('image/')) {
    return <IconPhoto style={{ width: rem(24), height: rem(24) }} stroke={1.5} />;
  }
  if (file.type.startsWith('audio/')) {
    return <IconFileMusic style={{ width: rem(24), height: rem(24) }} stroke={1.5} />;
  }
  if (file.type.startsWith('video/')) {
    return <IconVideo style={{ width: rem(24), height: rem(24) }} stroke={1.5} />;
  }
  return <IconFileText style={{ width: rem(24), height: rem(24) }} stroke={1.5} />;
};

const getIconForMime = (mime?: string) => {
  if (!mime) return <IconFileText style={{ width: rem(24), height: rem(24) }} stroke={1.5} />;
  if (mime.startsWith('image/')) return <IconPhoto style={{ width: rem(24), height: rem(24) }} stroke={1.5} />;
  if (mime.startsWith('audio/')) return <IconFileMusic style={{ width: rem(24), height: rem(24) }} stroke={1.5} />;
  if (mime.startsWith('video/')) return <IconVideo style={{ width: rem(24), height: rem(24) }} stroke={1.5} />;
  return <IconFileText style={{ width: rem(24), height: rem(24) }} stroke={1.5} />;
};

export function MediaUpload({
  files,
  onChange,
  maxFiles = 5,
  maxSize = 50,
  enableLibrary = false,
  orgId,
  selectedFiles = [],
  onSelectFile,
  onRemoveSelectedFile,
  libraryApiEndpoint,
}: MediaUploadProps) {
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const totalCount = files.length + selectedFiles.length;
  const remainingSlots = Math.max(maxFiles - totalCount, 0);

  const handleDrop = (droppedFiles: FileWithPath[]) => {
    const newFiles = [...files, ...droppedFiles].slice(0, maxFiles - selectedFiles.length);
    onChange(newFiles);

    droppedFiles.forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviews((prev) => ({
            ...prev,
            [getFileKey(file)]: reader.result as string,
          }));
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    const removedFile = files[index];
    const removedKey = getFileKey(removedFile);
    onChange(newFiles);
    setPreviews((prev) => {
      const next = { ...prev };
      delete next[removedKey];
      return next;
    });
  };

  const handleNextcloudFileSelect = (ncFile: NextcloudFile) => {
    if (ncFile.type === 'directory') return;
    if (totalCount >= maxFiles) return;
    if (!onSelectFile) return;

    const mediaUrl = `/api/media/${ncFile.filename.replace(/^\//, '')}`;
    onSelectFile({
      filename: ncFile.filename,
      basename: ncFile.basename,
      size: ncFile.size,
      mime: ncFile.mime,
      url: mediaUrl,
    });
  };

  const dropzoneContent = (
    <>
      <Dropzone
        onDrop={handleDrop}
        onReject={(files) => console.log('rejected files', files)}
        maxSize={maxSize * 1024 * 1024}
        maxFiles={remainingSlots}
        accept={ACCEPTED_TYPES}
        disabled={totalCount >= maxFiles}
        p="xs"
      >
        <Group justify="center" gap="sm" mih={48} style={{ pointerEvents: 'none' }}>
          <Dropzone.Accept>
            <IconUpload
              style={{ width: rem(24), height: rem(24), color: 'var(--mantine-color-blue-6)' }}
              stroke={1.5}
            />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX
              style={{ width: rem(24), height: rem(24), color: 'var(--mantine-color-red-6)' }}
              stroke={1.5}
            />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconPhoto
              style={{ width: rem(24), height: rem(24), color: 'var(--mantine-color-dimmed)' }}
              stroke={1.5}
            />
          </Dropzone.Idle>

          <div>
            <Text size="sm" inline>
              Drop files or click to upload
            </Text>
            <Text size="xs" c="dimmed" inline mt={2}>
              Max {maxFiles} files, {maxSize}MB each
              {totalCount >= maxFiles && ' — limit reached'}
            </Text>
          </div>
        </Group>
      </Dropzone>

      {/* File previews */}
      {(files.length > 0 || selectedFiles.length > 0) && (
        <Stack gap="sm" mt="md">
          {files.map((file, index) => (
            <Paper key={`upload-${index}`} p="xs" withBorder>
              <Group justify="space-between">
                <Group gap="sm">
                  {file.type.startsWith('image/') && previews[getFileKey(file)] ? (
                    <Image
                      src={previews[getFileKey(file)]}
                      alt={file.name}
                      width={60}
                      height={60}
                      fit="cover"
                      radius="sm"
                    />
                  ) : (
                    <ThemeIcon variant="light" color="gray" radius="md">
                      {getIconForFile(file)}
                    </ThemeIcon>
                  )}
                  <div>
                    <Text size="sm" fw={500}>{file.name}</Text>
                    <Text size="xs" c="dimmed">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </Text>
                  </div>
                </Group>
                <CloseButton onClick={() => removeFile(index)} />
              </Group>
            </Paper>
          ))}
          {selectedFiles.map((file, index) => (
            <Paper key={`nc-${index}`} p="xs" withBorder>
              <Group justify="space-between">
                <Group gap="sm">
                  <ThemeIcon variant="light" color="indigo" radius="md">
                    {getIconForMime(file.mime)}
                  </ThemeIcon>
                  <div>
                    <Group gap="xs">
                      <Text size="sm" fw={500}>{file.basename}</Text>
                      <Badge size="xs" variant="light" color="indigo">Library</Badge>
                    </Group>
                    <Text size="xs" c="dimmed">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </Text>
                  </div>
                </Group>
                {onRemoveSelectedFile && (
                  <CloseButton onClick={() => onRemoveSelectedFile(index)} />
                )}
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </>
  );

  // If library is not enabled or no orgId, render upload-only
  if (!enableLibrary || !orgId) {
    return <div>{dropzoneContent}</div>;
  }

  // Render with tabs
  return (
    <div>
      <Tabs defaultValue="upload">
        <Tabs.List>
          <Tabs.Tab value="upload" leftSection={<Upload size={14} />}>
            Upload
          </Tabs.Tab>
          <Tabs.Tab value="library" leftSection={<FolderOpen size={14} />}>
            Library
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="upload" pt="md">
          {dropzoneContent}
        </Tabs.Panel>

        <Tabs.Panel value="library" pt="md">
          {totalCount >= maxFiles ? (
            <Text size="sm" c="dimmed" ta="center" py="md">
              File limit reached. Remove a file to select more.
            </Text>
          ) : (
            <FileBrowser
              orgId={orgId}
              onFileSelect={handleNextcloudFileSelect}
              enableUpload={false}
              enableCreateFolder={false}
              apiEndpoint={libraryApiEndpoint}
            />
          )}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
