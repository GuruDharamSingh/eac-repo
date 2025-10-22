/**
 * Nextcloud Client - Core API wrapper
 * 
 * Handles authentication and provides base client for all operations
 */

import { createClient, WebDAVClient } from 'webdav';
import axios, { AxiosInstance } from 'axios';

export interface NextcloudConfig {
  baseUrl: string;
  username: string;
  password: string;
}

export interface NextcloudClient {
  config: NextcloudConfig;
  webdav: WebDAVClient;
  ocs: AxiosInstance;
}

/**
 * Create a Nextcloud client for a specific user
 * 
 * Usage in API routes:
 * ```typescript
 * const client = createNextcloudClient({
 *   baseUrl: process.env.NEXTCLOUD_URL!,
 *   username: user.nextcloud_user_id,
 *   password: user.nextcloud_app_password
 * });
 * ```
 */
export function createNextcloudClient(config: NextcloudConfig): NextcloudClient {
  // WebDAV client for file operations
  const webdav = createClient(
    `${config.baseUrl}/remote.php/dav/files/${config.username}`,
    {
      username: config.username,
      password: config.password,
    }
  );

  // OCS API client for app operations (users, shares, Talk, etc.)
  const ocs = axios.create({
    baseURL: `${config.baseUrl}/ocs/v2.php`,
    auth: {
      username: config.username,
      password: config.password,
    },
    headers: {
      'OCS-APIRequest': 'true',
      'Content-Type': 'application/json',
    },
    params: {
      format: 'json', // Always return JSON
    },
  });

  return {
    config,
    webdav,
    ocs,
  };
}

/**
 * Get admin client for privileged operations
 * 
 * Usage: User provisioning, system-wide operations
 * ```typescript
 * const admin = getAdminClient();
 * await admin.ocs.post('/cloud/users', { userid: 'newuser', ... });
 * ```
 */
export function getAdminClient(): NextcloudClient {
  const config: NextcloudConfig = {
    baseUrl: process.env.NEXTCLOUD_URL || 'http://nextcloud-nginx:80',
    username: process.env.NEXTCLOUD_ADMIN_USER || 'elkdonis',
    password: process.env.NEXTCLOUD_ADMIN_PASSWORD || 'Ea4thway',
  };

  return createNextcloudClient(config);
}

/**
 * Helper to handle OCS API responses
 * Nextcloud wraps responses in { ocs: { meta: {...}, data: {...} } }
 */
export function extractOcsData<T>(response: any): T {
  if (response.data?.ocs?.data) {
    return response.data.ocs.data as T;
  }
  throw new Error('Invalid OCS response format');
}

/**
 * Check if Nextcloud is reachable
 */
export async function healthCheck(baseUrl?: string): Promise<boolean> {
  try {
    const url = baseUrl || process.env.NEXTCLOUD_URL || 'http://nextcloud-nginx:80';
    const response = await axios.get(`${url}/status.php`);
    return response.data?.installed === true;
  } catch (error) {
    console.error('Nextcloud health check failed:', error);
    return false;
  }
}
