/**
 * Nextcloud Configuration
 * Central configuration for all Nextcloud integrations
 */

export const nextcloudConfig = {
  // Base URL for Nextcloud instance
  baseUrl: process.env.NEXTCLOUD_URL || 'http://nextcloud-nginx:80',

  // Admin credentials
  adminUser: process.env.NEXTCLOUD_ADMIN_USER || 'elkdonis',
  adminPassword: process.env.NEXTCLOUD_ADMIN_PASSWORD || 'Ea4thway',

  // API endpoints
  api: {
    ocs: '/ocs/v2.php',
    webdav: '/remote.php/webdav',
    dav: '/remote.php/dav',
    files: '/ocs/v2.php/apps/files_sharing/api/v1',
    talk: '/ocs/v2.php/apps/spreed/api/v4',
    users: '/ocs/v1.php/cloud/users',
    groups: '/ocs/v1.php/cloud/groups',
  },

  // Default settings
  defaults: {
    sharePermissions: 31, // All permissions
    shareType: 0, // User share
    groupShareType: 1, // Group share
  },

  // Organization folder structure
  folderStructure: {
    root: 'EAC-Network',
    subfolders: [
      'Media',
      'Media/Images',
      'Media/Audio',
      'Media/Videos',
      'Media/Documents',
    ],
  },
};

// Helper to build full URLs
export function getNextcloudUrl(path: string): string {
  return `${nextcloudConfig.baseUrl}${path}`;
}

// Helper to get WebDAV URL for a path (uses modern DAV endpoint with username)
export function getWebDAVUrl(username: string = nextcloudConfig.adminUser): string {
  return `${nextcloudConfig.baseUrl}/remote.php/dav/files/${username}`;
}

// Helper to get Talk API URL
export function getTalkUrl(endpoint: string): string {
  return `${nextcloudConfig.baseUrl}${nextcloudConfig.api.talk}/${endpoint}`;
}
