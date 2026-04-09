import { useState, useEffect, useCallback } from 'react';

export interface NextcloudFile {
  filename: string;
  basename: string;
  lastmod: string;
  size: number;
  type: 'file' | 'directory';
  etag: string;
  mime?: string;
}

interface UseNextcloudFilesOptions {
  orgId: string;
  initialPath?: string;
  apiEndpoint?: string;
  autoLoad?: boolean;
}

export function useNextcloudFiles({
  orgId,
  initialPath,
  apiEndpoint = '/api/nextcloud',
  autoLoad = true,
}: UseNextcloudFilesOptions) {
  const [currentPath, setCurrentPath] = useState(initialPath || `EAC-Network/${orgId}`);
  const [files, setFiles] = useState<NextcloudFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load files for current directory
  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiEndpoint}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', path: currentPath }),
      });

      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
      } else {
        throw new Error('Failed to load files');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
      console.error('Error loading files:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPath, apiEndpoint]);

  // Upload file
  const uploadFile = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);

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
        return true;
      } else {
        throw new Error('Failed to upload file');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
      console.error('Error uploading file:', err);
      return false;
    } finally {
      setUploading(false);
    }
  }, [currentPath, apiEndpoint, loadFiles]);

  // Create folder
  const createFolder = useCallback(async (folderName: string) => {
    if (!folderName) return false;

    setError(null);

    try {
      const response = await fetch(`${apiEndpoint}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createFolder',
          path: `${currentPath}/${folderName}`,
        }),
      });

      if (response.ok) {
        await loadFiles();
        return true;
      } else {
        throw new Error('Failed to create folder');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
      console.error('Error creating folder:', err);
      return false;
    }
  }, [currentPath, apiEndpoint, loadFiles]);

  // Navigate to parent directory
  const navigateBack = useCallback(() => {
    const parts = currentPath.split('/').filter(Boolean);
    if (parts.length > 2) {
      parts.pop();
      setCurrentPath(parts.join('/'));
    }
  }, [currentPath]);

  // Navigate to a directory
  const navigateToDirectory = useCallback((path: string) => {
    setCurrentPath(path);
  }, []);

  // Auto-load files when path changes
  useEffect(() => {
    if (autoLoad) {
      loadFiles();
    }
  }, [currentPath, autoLoad, loadFiles]);

  return {
    currentPath,
    files,
    loading,
    uploading,
    error,
    loadFiles,
    uploadFile,
    createFolder,
    navigateBack,
    navigateToDirectory,
  };
}