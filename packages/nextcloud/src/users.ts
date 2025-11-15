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
  const { userId, email, displayName, password } = options;

  // Generate secure password if not provided
  const userPassword = password || generateSecurePassword();

  try {
    // Create Nextcloud user via OCS API
    await adminClient.ocs.post('/cloud/users', {
      userid: userId,
      password: userPassword,
      email: email,
      displayname: displayName,
    });

    console.log(`✅ Created Nextcloud user: ${userId}`);
  } catch (error: any) {
    // User might already exist, that's okay
    if (error.response?.status === 400) {
      console.log(`ℹ️  Nextcloud user already exists: ${userId}`);
    } else {
      throw error;
    }
  }

  // Generate app password for API access
  // This is more secure than using main password
  const appPassword = await generateAppPassword(adminClient, userId);

  // Update your database with credentials
  await db`
    UPDATE users
    SET nextcloud_user_id = ${userId},
        nextcloud_app_password = ${appPassword},
        nextcloud_synced = true
    WHERE id = ${userId}
  `;

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
  _userId: string
): Promise<string> {
  // For now, generate a secure password to use as both user password and app password
  // This is simpler but less secure than proper app passwords
  // TODO: Implement proper app password generation via Nextcloud API when user session tokens are available
  return generateSecurePassword();
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
  await db`
    UPDATE users 
    SET nextcloud_user_id = NULL,
        nextcloud_synced = false
    WHERE id = ${userId}
  `;
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
