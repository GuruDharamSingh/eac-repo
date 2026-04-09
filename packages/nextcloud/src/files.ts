/**
 * Nextcloud Files API
 * 
 * File operations using WebDAV
 * Each app imports only if they need file functionality
 */

import { type NextcloudClient } from './client';
import { type FileStat } from 'webdav';

export interface FileUploadOptions {
  /**
   * Organization folder path (e.g., "/Elkdonis/Sunjay")
   */
  orgPath?: string;
  /**
   * Subfolder within org (e.g., "meetings/abc123")
   */
  subfolder?: string;
  /**
   * Overwrite if exists
   */
  overwrite?: boolean;
}

export interface NextcloudFile {
  id: string;
  path: string;
  filename: string;
  size: number;
  mimeType: string;
  url: string;
  lastModified: Date;
}

/**
 * Upload a file to Nextcloud
 * 
 * Usage in API route:
 * ```typescript
 * import { uploadFile } from '@elkdonis/nextcloud/files';
 * 
 * const result = await uploadFile(client, file, {
 *   orgPath: '/Elkdonis/Sunjay',
 *   subfolder: 'meetings/abc123'
 * });
 * ```
 */
export async function uploadFile(
  client: NextcloudClient,
  file: File | Buffer,
  options: FileUploadOptions = {}
): Promise<NextcloudFile> {
  const { orgPath = '', subfolder = '', overwrite = true } = options;
  
  // Build full path
  const filename = file instanceof File ? file.name : 'upload';
  const fullPath = [orgPath, subfolder, filename]
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/'); // Remove double slashes

  // Get file buffer
  const buffer = file instanceof File ? Buffer.from(await file.arrayBuffer()) : file;

  // Upload via WebDAV
  await client.webdav.putFileContents(fullPath, buffer, {
    overwrite,
  });

  // Get file info
  const stat = (await client.webdav.stat(fullPath)) as FileStat;

  // Extract file ID from Nextcloud's response
  const fileId = extractFileId(stat);

  return {
    id: fileId,
    path: fullPath,
    filename,
    size: stat.size,
    mimeType: stat.mime || 'application/octet-stream',
    url: `${client.config.baseUrl}/f/${fileId}`,
    lastModified: new Date(stat.lastmod),
  };
}

/**
 * List files in a directory
 */
export async function listFiles(
  client: NextcloudClient,
  path: string = '/'
): Promise<NextcloudFile[]> {
  const items = (await client.webdav.getDirectoryContents(path)) as FileStat[];

  return items
    .filter((item) => item.type === 'file')
    .map((item) => ({
      id: extractFileId(item),
      path: item.filename,
      filename: item.basename,
      size: item.size,
      mimeType: item.mime || 'application/octet-stream',
      url: `${client.config.baseUrl}/f/${extractFileId(item)}`,
      lastModified: new Date(item.lastmod),
    }));
}

/**
 * Download a file
 */
export async function downloadFile(
  client: NextcloudClient,
  path: string
): Promise<Buffer> {
  const contents = await client.webdav.getFileContents(path);
  return Buffer.from(contents as ArrayBuffer);
}

/**
 * Delete a file
 */
export async function deleteFile(
  client: NextcloudClient,
  path: string
): Promise<void> {
  await client.webdav.deleteFile(path);
}

/**
 * Create a folder
 */
export async function createFolder(
  client: NextcloudClient,
  path: string
): Promise<void> {
  await client.webdav.createDirectory(path);
}

/**
 * Check if file/folder exists
 */
export async function exists(
  client: NextcloudClient,
  path: string
): Promise<boolean> {
  return await client.webdav.exists(path);
}

/**
 * Move/rename a file
 */
export async function moveFile(
  client: NextcloudClient,
  fromPath: string,
  toPath: string
): Promise<void> {
  await client.webdav.moveFile(fromPath, toPath);
}

/**
 * Get public share link for a file
 */
export async function createShareLink(
  client: NextcloudClient,
  path: string,
  permissions: { read?: boolean; write?: boolean } = { read: true }
): Promise<string> {
  const response = await client.ocs.post('/apps/files_sharing/api/v1/shares', {
    path,
    shareType: 3, // Public link
    permissions: permissions.write ? 15 : 1, // 15 = all, 1 = read
  });

  return response.data.ocs.data.url;
}

/**
 * Helper to extract file ID from WebDAV stat response
 * Nextcloud stores file ID in props
 */
function extractFileId(stat: FileStat): string {
  // Try to extract from props
  const props = stat.props as any;
  if (props?.fileid) {
    return props.fileid.toString();
  }
  
  // Fallback: use filename as ID
  return stat.filename.split('/').pop() || stat.filename;
}
