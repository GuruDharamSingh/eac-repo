/**
 * POST /api/auth/provision-nextcloud
 *
 * Called after successful signup to provision user in Nextcloud
 * This runs as a background task after user creation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';
import { handleUserProvisioning } from '@elkdonis/services';

export async function POST(request: NextRequest) {
  try {
    // Get current user from session
    const session = await getServerSession();

    if (!session.user) {
      return NextResponse.json(
        { error: 'Unauthorized - no session found' },
        { status: 401 }
      );
    }

    const { user } = session;

    // Check if already provisioned
    if (user.nextcloud_user_id) {
      console.log(`[Provisioning] User ${user.email} already has Nextcloud account`);
      return NextResponse.json({
        success: true,
        message: 'User already provisioned',
        nextcloudUserId: user.nextcloud_user_id,
      });
    }

    // Provision user in Nextcloud
    const displayName = user.email?.split('@')[0] || 'User';
    const result = await handleUserProvisioning(
      user.id,
      user.email!,
      displayName
    );

    if (!result.success) {
      console.error(`[Provisioning] Failed for ${user.email}:`, result.error);
      return NextResponse.json(
        { error: result.error || 'Provisioning failed' },
        { status: 500 }
      );
    }

    console.log(`[Provisioning] ✅ User ${user.email} provisioned successfully`);

    return NextResponse.json({
      success: true,
      message: 'User provisioned successfully',
      nextcloudUserId: result.nextcloudUserId,
    });

  } catch (error) {
    console.error('[Provisioning] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
