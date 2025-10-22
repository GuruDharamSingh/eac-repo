'use client';

import { useState, useEffect } from 'react';
import { Card, Stack, Group, Text, Button, ActionIcon, TextInput, Loader } from '@mantine/core';
// @ts-expect-error - Download is imported for future download functionality
import { Folder, File, Upload, Download, Plus, ChevronLeft } from 'lucide-react';

export interface NextcloudFile {
  filename: string;
  basename: string;
  lastmod: string;
  size: number;
  type: 'file' | 'directory';
  etag: string;
  mime?: string;
}

export interface FileBrowserProps {
  orgId: string;
  currentPath?: string;
  onFileSelect?: (file: NextcloudFile) => void;
  onPathChange?: (path: string) => void;
  enableUpload?: boolean;
  enableCreateFolder?: boolean;
  apiEndpoint?: string;
}

export function FileBrowser({
  orgId,
  currentPath: initialPath,
  onFileSelect,
  onPathChange,
  enableUpload = true,
  enableCreateFolder = true,
  apiEndpoint = '/api/nextcloud'
}: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState(initialPath || `EAC-Network/${orgId}`);
  const [files, setFiles] = useState<NextcloudFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);

  // Load files for current directory
  const loadFiles = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiEndpoint}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', path: currentPath }),
      });

      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
      }
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [currentPath]);

  useEffect(() => {
    if (onPathChange) {
      onPathChange(currentPath);
    }
  }, [currentPath, onPathChange]);

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', `${currentPath}/${file.name}`);

    try {
      const response = await fetch(`${apiEndpoint}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        await loadFiles();
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploading(false);
    }
  };

  // Handle folder creation
  const handleCreateFolder = async () => {
    if (!newFolderName) return;

    try {
      const response = await fetch(`${apiEndpoint}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createFolder',
          path: `${currentPath}/${newFolderName}`,
        }),
      });

      if (response.ok) {
        setNewFolderName('');
        setShowNewFolder(false);
        await loadFiles();
      }
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  // Handle file/folder navigation
  const handleItemClick = (item: NextcloudFile) => {
    if (item.type === 'directory') {
      setCurrentPath(item.filename);
    } else if (onFileSelect) {
      onFileSelect(item);
    }
  };

  // Handle navigation back
  const handleGoBack = () => {
    const parts = currentPath.split('/').filter(Boolean);
    if (parts.length > 2) {
      parts.pop();
      setCurrentPath('/' + parts.join('/'));
    }
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <Card withBorder radius="md">
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between">
          <Group>
            <ActionIcon
              variant="subtle"
              onClick={handleGoBack}
              disabled={currentPath === `/EAC-Network/${orgId}`}
            >
              <ChevronLeft size={18} />
            </ActionIcon>
            <Text size="sm" c="dimmed">
              {currentPath}
            </Text>
          </Group>

          <Group>
            {showNewFolder ? (
              <Group gap="xs">
                <TextInput
                  size="xs"
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateFolder();
                    if (e.key === 'Escape') {
                      setShowNewFolder(false);
                      setNewFolderName('');
                    }
                  }}
                />
                <Button size="xs" onClick={handleCreateFolder}>
                  Create
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={() => {
                    setShowNewFolder(false);
                    setNewFolderName('');
                  }}
                >
                  Cancel
                </Button>
              </Group>
            ) : (
              <>
                {enableCreateFolder && (
                  <Button
                    size="xs"
                    variant="subtle"
                    leftSection={<Plus size={14} />}
                    onClick={() => setShowNewFolder(true)}
                  >
                    New Folder
                  </Button>
                )}
                {enableUpload && (
                  <Button
                    size="xs"
                    leftSection={uploading ? <Loader size={14} /> : <Upload size={14} />}
                    disabled={uploading}
                    component="label"
                  >
                    Upload
                    <input
                      type="file"
                      hidden
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </Button>
                )}
              </>
            )}
          </Group>
        </Group>

        {/* File List */}
        {loading ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : files.length === 0 ? (
          <Text ta="center" py="xl" c="dimmed">
            No files in this folder
          </Text>
        ) : (
          <Stack gap={4}>
            {files.map((file) => (
              <Group
                key={file.filename}
                p="xs"
                style={{
                  cursor: 'pointer',
                  borderRadius: 4,
                  '&:hover': { backgroundColor: 'var(--mantine-color-gray-0)' },
                }}
                onClick={() => handleItemClick(file)}
              >
                <Group style={{ flex: 1 }} gap="xs">
                  {file.type === 'directory' ? (
                    <Folder size={18} />
                  ) : (
                    <File size={18} />
                  )}
                  <Text size="sm">{file.basename}</Text>
                </Group>
                <Text size="xs" c="dimmed">
                  {file.type === 'file' && formatSize(file.size)}
                </Text>
              </Group>
            ))}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}