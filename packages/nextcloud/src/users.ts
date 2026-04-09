/**
 * Nextcloud Users API
 * 
 * User provisioning and management
 * Only imported by apps that need user sync (likely just admin app)
 */

import { type NextcloudClient, extractOcsData } from './client';
import { db } from '@elkdonis/db';

export interface NextcloudUser {
  id: string;
  displayName: string;
  email: string;
}

export interface ProvisionUserOptions {
  userId: string;
  email: string;
  displayName: string;
  password?: string; // Optional, will generate if not provided
  groups?: string[]; // Optional Nextcloud groups to add user to
}

/**
 * Auto-provision a Nextcloud user when they sign up
 * 
 * Usage in auth callback:
 * ```typescript
 * import { provisionUser } from '@elkdonis/nextcloud/users';
 * 
 * await provisionUser(adminClient, {
 *   userId: user.id,
 *   email: user.email,
 *   displayName: user.display_name
 * });
 * ```
 */
export async function provisionUser(
  adminClient: NextcloudClient,
  options: ProvisionUserOptions
): Promise<{ userId: string; appPassword: string }> {
  const { userId, email, displayName, password, groups } = options;

  // Prefer idempotency: if DB already has creds, reuse them.
  const existingCreds = await readStoredCredentials(userId);
  if (existingCreds?.nextcloud_user_id && existingCreds?.nextcloud_app_password) {
    return { userId: existingCreds.nextcloud_user_id, appPassword: existingCreds.nextcloud_app_password };
  }

  // Generate secure password if not provided.
  // NOTE: Today this is also used as the API credential stored in DB.
  const userPassword = password || generateSecurePassword();
  let userCreated = false;

  try {
    // Create Nextcloud user via OCS API
    const formData = new URLSearchParams();
    formData.set('userid', userId);
    formData.set('password', userPassword);
    formData.set('email', email);
    formData.set('displayname', displayName);

    await adminClient.ocs.post('/cloud/users', formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    console.log(`✅ Created Nextcloud user: ${userId}`);
    userCreated = true;
  } catch (error: any) {
    // User might already exist, that's okay
    if (error.response?.status === 400) {
      console.log(`ℹ️  Nextcloud user already exists: ${userId}`);
    } else {
      throw error;
    }
  }

  // If the user already existed but we don't have stored credentials, set a new password
  // so server-side integrations can authenticate as that user.
  if (!userCreated) {
    const hasPasswordStored = Boolean(existingCreds?.nextcloud_app_password);
    if (!hasPasswordStored) {
      await setUserPassword(adminClient, userId, userPassword);
    }
  }

  // Generate app password for API access.
  // For now this falls back to using the same credential we just set, to ensure it is valid.
  const appPassword = await generateAppPassword(adminClient, userId, userPassword);

  // Update your database with credentials
  await writeStoredCredentials(userId, {
    nextcloud_user_id: userId,
    nextcloud_app_password: appPassword,
    nextcloud_synced: true,
  });

  if (groups && groups.length > 0) {
    for (const groupId of groups) {
      await ensureGroup(adminClient, groupId);
      await addUserToGroup(adminClient, userId, groupId);
    }
  }

  return { userId, appPassword };
}

/**
 * Generate an app password for a user
 * App passwords are safer than real passwords and can be revoked
 *
 * NOTE: Currently using the same password for both user login and API access.
 * In production, implement Nextcloud's proper app password API:
 * POST /ocs/v2.php/core/apppassword (requires user session token)
 */
export async function generateAppPassword(
  _adminClient: NextcloudClient,
  _userId: string,
  fallbackPassword: string
): Promise<string> {
  // Today we store the same credential we set on the Nextcloud user.
  // This keeps server-side WebDAV/OCS/CalDAV calls reliable.
  // TODO: Implement real app password creation (per-user) and store that instead.
  return fallbackPassword;
}

/**
 * Get Nextcloud user info
 */
export async function getUser(
  client: NextcloudClient,
  userId: string
): Promise<NextcloudUser> {
  const response = await client.ocs.get(`/cloud/users/${userId}`);
  const data = extractOcsData<any>(response);

  return {
    id: data.id,
    displayName: data.displayname || data.id,
    email: data.email || '',
  };
}

/**
 * Delete a Nextcloud user
 */
export async function deleteUser(
  adminClient: NextcloudClient,
  userId: string
): Promise<void> {
  await adminClient.ocs.delete(`/cloud/users/${userId}`);

  // Update your database
  await writeStoredCredentials(userId, {
    nextcloud_user_id: null,
    nextcloud_app_password: null,
    nextcloud_synced: false,
  });
}

/**
 * Sync all users from your database to Nextcloud
 * Run this once during migration or setup
 */
export async function syncAllUsers(adminClient: NextcloudClient): Promise<void> {
  console.log('🔄 Syncing users to Nextcloud...');

  const users = await db`
    SELECT id, email, display_name 
    FROM users 
    WHERE nextcloud_synced = false OR nextcloud_synced IS NULL
  `;

  for (const user of users) {
    try {
      await provisionUser(adminClient, {
        userId: user.id,
        email: user.email,
        displayName: user.display_name || user.email,
      });
      console.log(`✅ Synced user: ${user.email}`);
    } catch (error) {
      console.error(`❌ Failed to sync user: ${user.email}`, error);
    }
  }

  console.log('✅ User sync complete');
}

/**
 * Generate a secure random password
 */
function generateSecurePassword(length: number = 32): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // Use crypto.randomBytes if available (Node.js)
  if (typeof require !== 'undefined') {
    try {
      const crypto = require('crypto');
      const bytes = crypto.randomBytes(length);
      for (let i = 0; i < length; i++) {
        password += charset[bytes[i] % charset.length];
      }
      return password;
    } catch (e) {
      // Fall through to Math.random
    }
  }

  // Fallback to Math.random
  for (let i = 0; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  return password;
}

async function setUserPassword(
  adminClient: NextcloudClient,
  userId: string,
  password: string
): Promise<void> {
  const formData = new URLSearchParams();
  formData.set('key', 'password');
  formData.set('value', password);

  await adminClient.ocs.put(`/cloud/users/${userId}`, formData.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}

async function ensureGroup(adminClient: NextcloudClient, groupId: string): Promise<void> {
  const formData = new URLSearchParams();
  formData.set('groupid', groupId);

  try {
    await adminClient.ocs.post('/cloud/groups', formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  } catch (error: any) {
    if (error.response?.status === 400) return;
    throw error;
  }
}

async function addUserToGroup(
  adminClient: NextcloudClient,
  userId: string,
  groupId: string
): Promise<void> {
  const formData = new URLSearchParams();
  formData.set('groupid', groupId);

  try {
    await adminClient.ocs.post(`/cloud/users/${userId}/groups`, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  } catch (error: any) {
    if (error.response?.status === 400) return;
    throw error;
  }
}

async function readStoredCredentials(userId: string): Promise<{
  id: string;
  nextcloud_user_id: string | null;
  nextcloud_app_password: string | null;
  nextcloud_synced: boolean | null;
} | null> {
  const [byId] = await db`
    SELECT id, nextcloud_user_id, nextcloud_app_password, nextcloud_synced
    FROM users
    WHERE id = ${userId}
  `;
  if (byId) return byId as any;

  try {
    const [byAuthUserId] = await db`
      SELECT id, nextcloud_user_id, nextcloud_app_password, nextcloud_synced
      FROM users
      WHERE auth_user_id = ${userId}
    `;
    return (byAuthUserId as any) ?? null;
  } catch (_err) {
    return null;
  }
}

async function writeStoredCredentials(
  userId: string,
  fields: {
    nextcloud_user_id: string | null;
    nextcloud_app_password: string | null;
    nextcloud_synced: boolean;
  }
): Promise<void> {
  const [updatedById] = await db`
    UPDATE users
    SET
      nextcloud_user_id = ${fields.nextcloud_user_id},
      nextcloud_app_password = ${fields.nextcloud_app_password},
      nextcloud_synced = ${fields.nextcloud_synced}
    WHERE id = ${userId}
    RETURNING id
  `;
  if (updatedById) return;

  try {
    await db`
      UPDATE users
      SET
        nextcloud_user_id = ${fields.nextcloud_user_id},
        nextcloud_app_password = ${fields.nextcloud_app_password},
        nextcloud_synced = ${fields.nextcloud_synced}
      WHERE auth_user_id = ${userId}
    `;
  } catch (_err) {
    // Ignore if auth_user_id column doesn't exist.
  }
}
