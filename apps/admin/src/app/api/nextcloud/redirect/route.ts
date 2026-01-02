import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';
import { db } from '@elkdonis/db';

/**
 * GET /api/nextcloud/redirect
 *
 * Handles redirecting to Nextcloud with proper SSO.
 * If a target path is provided, redirects to that path after login.
 * Handles user switching by forcing logout if needed.
 *
 * Query params:
 * - target: Path in Nextcloud to redirect to (e.g., /apps/files, /apps/talk)
 * - force: If 'true', forces re-authentication even if already logged in
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

    // Check if user is synced to Nextcloud
    if (!user.nextcloud_synced || !user.nextcloud_user_id) {
      // User not synced - show helpful message
      return NextResponse.json({
        error: 'not_synced',
        message: 'Your account is not connected to Nextcloud yet. Please contact an administrator.',
        user: {
          email: user.email,
          isAdmin: user.is_admin,
        },
      }, { status: 403 });
    }

    // Get query params (support both 'target' and 'returnTo')
    const searchParams = request.nextUrl.searchParams;
    const target = searchParams.get('target') || searchParams.get('returnTo') || '/';
    const force = searchParams.get('force') === 'true';

    // Build Nextcloud URL
    const nextcloudBaseUrl = process.env.NEXT_PUBLIC_NEXTCLOUD_URL || 'http://localhost:8080';

    // If force is true, we first logout from Nextcloud then login
    // This ensures the correct user is logged in
    if (force) {
      // Construct logout URL that redirects back to sociallogin
      const socialLoginUrl = new URL('/apps/sociallogin/custom_oauth2/elkdonis', nextcloudBaseUrl);
      const logoutUrl = new URL('/logout', nextcloudBaseUrl);
      logoutUrl.searchParams.set('requesttoken', ''); // Will need to handle CSRF
      logoutUrl.searchParams.set('redirect_url', socialLoginUrl.toString());

      return NextResponse.redirect(logoutUrl);
    }

    // Construct the social login URL
    // Nextcloud's sociallogin app will handle the OAuth2 flow
    const socialLoginUrl = new URL('/apps/sociallogin/custom_oauth2/elkdonis', nextcloudBaseUrl);

    // If there's a target, we need to pass it through
    // Nextcloud sociallogin supports redirect_url parameter
    if (target && target !== '/') {
      const targetUrl = new URL(target, nextcloudBaseUrl);
      socialLoginUrl.searchParams.set('redirect_url', targetUrl.toString());
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
