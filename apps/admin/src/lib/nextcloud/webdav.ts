/**
 * Nextcloud WebDAV Integration
 * Handles file and folder operations via WebDAV
 */

import { createClient, WebDAVClient, FileStat } from 'webdav';
import { nextcloudConfig, getWebDAVUrl } from './config';

export interface NextcloudFile {
  filename: string;
  basename: string;
  lastmod: string;
  size: number;
  type: 'file' | 'directory';
  etag: string;
  mime?: string;
}

class WebDAVService {
  private client: WebDAVClient;

  constructor(username?: string, password?: string) {
    const user = username || nextcloudConfig.adminUser;
    const pass = password || nextcloudConfig.adminPassword;

    this.client = createClient(getWebDAVUrl(user), {
      username: user,
      password: pass,
    });
  }

  /**
   * List contents of a directory
   */
  async listDirectory(path: string = '/'): Promise<NextcloudFile[]> {
    try {
      const contents = await this.client.getDirectoryContents(path) as FileStat[];

      return contents.map(item => ({
        filename: item.filename,
        basename: item.basename,
        lastmod: item.lastmod,
        size: item.size || 0,
        type: item.type === 'directory' ? 'directory' : 'file',
        etag: item.etag || '',
        mime: item.mime,
      }));
    } catch (error) {
      console.error('Error listing directory:', error);
      throw error;
    }
  }

  /**
   * Create a directory
   */
  async createDirectory(path: string): Promise<void> {
    try {
      await this.client.createDirectory(path);
    } catch (error: any) {
      // Ignore if directory already exists
      if (error?.response?.status !== 405) {
        console.error('Error creating directory:', error);
        throw error;
      }
    }
  }

  /**
   * Create organization folder structure
   */
  async createOrgFolders(orgId: string): Promise<void> {
    const rootPath = `${nextcloudConfig.folderStructure.root}/${orgId}`;

    // Create root org folder
    await this.createDirectory(rootPath);

    // Create subfolders
    for (const subfolder of nextcloudConfig.folderStructure.subfolders) {
      await this.createDirectory(`${rootPath}/${subfolder}`);
    }
  }

  /**
   * Upload a file
   */
  async uploadFile(
    path: string,
    content: Buffer | string | ReadableStream,
    options?: { overwrite?: boolean }
  ): Promise<boolean> {
    try {
      await this.client.putFileContents(path, content, {
        overwrite: options?.overwrite ?? true,
      });
      return true;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Download a file
   */
  async downloadFile(path: string): Promise<Buffer> {
    try {
      const content = await this.client.getFileContents(path) as Buffer;
      return content;
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  }

  /**
   * Delete a file or directory
   */
  async delete(path: string): Promise<void> {
    try {
      await this.client.deleteFile(path);
    } catch (error) {
      console.error('Error deleting file/directory:', error);
      throw error;
    }
  }

  /**
   * Move/rename a file or directory
   */
  async move(fromPath: string, toPath: string): Promise<void> {
    try {
      await this.client.moveFile(fromPath, toPath);
    } catch (error) {
      console.error('Error moving file/directory:', error);
      throw error;
    }
  }

  /**
   * Copy a file or directory
   */
  async copy(fromPath: string, toPath: string): Promise<void> {
    try {
      await this.client.copyFile(fromPath, toPath);
    } catch (error) {
      console.error('Error copying file/directory:', error);
      throw error;
    }
  }

  /**
   * Check if a file or directory exists
   */
  async exists(path: string): Promise<boolean> {
    try {
      await this.client.stat(path);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file/directory information
   */
  async getInfo(path: string): Promise<NextcloudFile | null> {
    try {
      const stat = await this.client.stat(path) as FileStat;
      return {
        filename: stat.filename,
        basename: stat.basename,
        lastmod: stat.lastmod,
        size: stat.size || 0,
        type: stat.type === 'directory' ? 'directory' : 'file',
        etag: stat.etag || '',
        mime: stat.mime,
      };
    } catch (error) {
      console.error('Error getting file info:', error);
      return null;
    }
  }

  /**
   * Create a public share link for a file/folder
   */
  async createShareLink(path: string, password?: string): Promise<string> {
    // This would need to be implemented via OCS API
    // WebDAV doesn't directly support creating shares
    // For now, return a placeholder
    console.log('Creating share link for:', path);
    return `${nextcloudConfig.baseUrl}/s/SHARE_TOKEN`;
  }
}

// Export singleton instance for admin operations
export const webdavService = new WebDAVService();

// Export class for creating user-specific instances
export default WebDAVService;