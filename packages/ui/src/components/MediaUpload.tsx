'use client';

import { Group, Text, rem, Stack, Image, CloseButton, Paper, ThemeIcon } from '@mantine/core';
import { Dropzone, FileWithPath } from '@mantine/dropzone';
import { IconUpload, IconPhoto, IconX, IconVideo, IconFileMusic, IconFileText } from '@tabler/icons-react';
import { useState } from 'react';

export interface MediaUploadProps {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number; // in MB
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

export function MediaUpload({
  files,
  onChange,
  maxFiles = 5,
  maxSize = 50 // 50MB default
}: MediaUploadProps) {
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const remainingSlots = Math.max(maxFiles - files.length, 0);

  const handleDrop = (droppedFiles: FileWithPath[]) => {
    const newFiles = [...files, ...droppedFiles].slice(0, maxFiles);
    onChange(newFiles);

    // Generate previews for images
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

  return (
    <div>
      <Text size="sm" fw={500} mb={4}>
        Media
      </Text>

      <Dropzone
        onDrop={handleDrop}
        onReject={(files) => console.log('rejected files', files)}
        maxSize={maxSize * 1024 * 1024}
        maxFiles={remainingSlots}
        accept={ACCEPTED_TYPES}
        disabled={files.length >= maxFiles}
      >
        <Group justify="center" gap="xl" mih={120} style={{ pointerEvents: 'none' }}>
          <Dropzone.Accept>
            <IconUpload
              style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-blue-6)' }}
              stroke={1.5}
            />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX
              style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-red-6)' }}
              stroke={1.5}
            />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconPhoto
              style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-dimmed)' }}
              stroke={1.5}
            />
          </Dropzone.Idle>

          <div>
            <Text size="xl" inline>
              Drag media here or click to select
            </Text>
            <Text size="sm" c="dimmed" inline mt={7}>
              Images, audio, video, and documents. Max {maxFiles} files, up to {maxSize}MB each.
            </Text>
            {files.length >= maxFiles && (
              <Text size="xs" c="dimmed" mt={4}>
                Remove a file to upload another.
              </Text>
            )}
          </div>
        </Group>
      </Dropzone>

      {/* Preview uploaded files */}
      {files.length > 0 && (
        <Stack gap="sm" mt="md">
          {files.map((file, index) => (
            <Paper key={index} p="xs" withBorder>
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
                    <Text size="sm" fw={500}>
                      {file.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </Text>
                  </div>
                </Group>
                <CloseButton onClick={() => removeFile(index)} />
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </div>
  );
}
