import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';
import { db } from '@elkdonis/db';

/**
 * GET /api/nextcloud/redirect
 *
 * Handles redirecting to Nextcloud with proper SSO.
 * Ensures user is authenticated with their app account before accessing Nextcloud.
 *
 * Query params:
 * - returnTo: Full URL in Nextcloud to redirect to (e.g., Talk room URL)
 * - target: Path in Nextcloud to redirect to (e.g., /apps/files)
 * - force: If 'true', forces re-authentication
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session.user) {
      // Not logged in - redirect to login with return URL
      const loginUrl = new URL('/login', request.nextUrl.origin);
      loginUrl.searchParams.set('returnTo', request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Get user's Nextcloud status
    const [user] = await db`
      SELECT
        id,
        email,
        nextcloud_synced,
        nextcloud_user_id,
        is_admin
      FROM users
      WHERE id = ${session.user.id}
    `;

    if (!user) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }

    const nextcloudBaseUrl = process.env.NEXT_PUBLIC_NEXTCLOUD_URL || 'http://localhost:8080';

    // Check if user is synced to Nextcloud
    if (!user.nextcloud_synced || !user.nextcloud_user_id) {
      // User not synced - redirect to a page explaining the situation
      const notSyncedUrl = new URL('/account', request.nextUrl.origin);
      notSyncedUrl.searchParams.set('error', 'nextcloud_not_synced');
      notSyncedUrl.searchParams.set('message', 'Your account is not connected to Nextcloud yet.');
      return NextResponse.redirect(notSyncedUrl);
    }

    // Get query params (support both 'target' and 'returnTo')
    const searchParams = request.nextUrl.searchParams;
    const returnTo = searchParams.get('returnTo');
    const target = searchParams.get('target') || '/';
    const force = searchParams.get('force') === 'true';

    // Build the social login URL - this triggers OAuth2 auth with Nextcloud
    const socialLoginUrl = new URL('/apps/sociallogin/custom_oauth2/elkdonis', nextcloudBaseUrl);

    // Determine the final redirect destination
    let finalDestination: string;
    if (returnTo) {
      // returnTo is a full URL (e.g., Talk room URL)
      finalDestination = returnTo;
    } else if (target && target !== '/') {
      // target is a path - build full URL
      finalDestination = new URL(target, nextcloudBaseUrl).toString();
    } else {
      finalDestination = nextcloudBaseUrl;
    }

    // Pass the redirect destination to sociallogin
    socialLoginUrl.searchParams.set('redirect_url', finalDestination);

    // If force logout is requested
    if (force) {
      // First logout from Nextcloud, then redirect to sociallogin
      const logoutUrl = new URL('/logout', nextcloudBaseUrl);
      logoutUrl.searchParams.set('redirect_url', socialLoginUrl.toString());
      return NextResponse.redirect(logoutUrl);
    }

    return NextResponse.redirect(socialLoginUrl);
  } catch (error: any) {
    console.error('Error in Nextcloud redirect:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to redirect' },
      { status: 500 }
    );
  }
}
