/**
 * Nextcloud User Provisioning Service
 *
 * Automatically provisions users in Nextcloud when they sign up via Supabase Auth
 * Creates user account and generates app password for API access
 */

import { getAdminClient } from '@elkdonis/nextcloud';
import { provisionUser } from '@elkdonis/nextcloud';

export interface ProvisioningResult {
  success: boolean;
  nextcloudUserId?: string;
  appPassword?: string;
  error?: string;
}

export interface ProvisioningOptions {
  groups?: string[];
}

/**
 * Complete provisioning workflow
 * Called after user signs up via Supabase Auth
 *
 * This function is called by the database trigger after a user is created in auth.users
 */
export async function handleUserProvisioning(
  userId: string,
  email: string,
  displayName: string,
  options?: ProvisioningOptions
): Promise<ProvisioningResult> {
  try {
    console.log(`[Nextcloud Provisioning] Starting for user ${email} (${userId})`);

    // Get Nextcloud admin client
    const adminClient = getAdminClient();

    // Provision user in Nextcloud (creates user + app password)
    const result = await provisionUser(adminClient, {
      userId,
      email,
      displayName: displayName || email.split('@')[0],
      groups: options?.groups,
    });

    console.log(`[Nextcloud Provisioning] ✅ Success for ${email} → ${result.userId}`);

    return {
      success: true,
      nextcloudUserId: result.userId,
      appPassword: result.appPassword,
    };

  } catch (error) {
    console.error('[Nextcloud Provisioning] ❌ Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
