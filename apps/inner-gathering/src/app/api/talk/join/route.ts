import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';
import { db } from '@elkdonis/db';
import { SignJWT } from 'jose';

/**
 * Talk Room Join Redirect
 *
 * Strategy: Try to ensure user has Nextcloud session before accessing Talk room
 * - Check for recent OAuth completion cookie
 * - If present: direct redirect (they should have NC session)
 * - If not: OAuth flow to establish session
 *
 * Usage: /api/talk/join?token=ROOM_TOKEN
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const skipOAuth = req.nextUrl.searchParams.get('skip_oauth') === 'true';

  if (!token) {
    return NextResponse.json({ error: 'Missing room token' }, { status: 400 });
  }

  // Verify user is logged in to inner-gathering
  const session = await getServerSession();
  if (!session.user) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('returnTo', req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Get user details and verify Nextcloud sync
  const [user] = await db`
    SELECT id, email, display_name, nextcloud_synced, nextcloud_user_id, nextcloud_app_password
    FROM users
    WHERE id = ${session.user.id}
  `;

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (!user.nextcloud_synced || !user.nextcloud_user_id) {
    const accountUrl = new URL('/account', req.nextUrl.origin);
    accountUrl.searchParams.set('error', 'nextcloud_not_synced');
    accountUrl.searchParams.set('message', 'Please sync your Nextcloud account to join Talk rooms');
    return NextResponse.redirect(accountUrl);
  }

  const nextcloudUrl = process.env.NEXTCLOUD_PUBLIC_URL || 'http://localhost:8080';
  const talkUrl = `${nextcloudUrl}/call/${token}`;

  // Check if user recently completed OAuth (within last 2 minutes)
  const oauthTimestamp = req.cookies.get('eac_nc_oauth_ts')?.value;
  const now = Date.now();
  const twoMinutesAgo = now - (2 * 60 * 1000);
  const hasRecentOAuth = oauthTimestamp && parseInt(oauthTimestamp) > twoMinutesAgo;

  if (hasRecentOAuth || skipOAuth) {
    // User recently went through OAuth or explicitly skipping
    // They should have a valid Nextcloud session
    console.log('[talk/join] Recent OAuth or skip_oauth=true, direct redirect to Talk room');

    return NextResponse.redirect(talkUrl);
  }

  // No recent OAuth - go through SSO flow to ensure they have Nextcloud session
  console.log('[talk/join] No recent OAuth, initiating SSO flow for user:', user.nextcloud_user_id);

  // Create signed JWT with user identity
  const secret = new TextEncoder().encode(process.env.INTER_APP_JWT_SECRET);
  const userToken = await new SignJWT({
    userId: user.id,
    email: user.email,
    displayName: user.display_name,
    nextcloudUserId: user.nextcloud_user_id,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .setIssuer('inner-gathering')
    .setAudience('admin-oidc')
    .sign(secret);

  // Redirect to Social Login with Talk room as destination
  const socialLoginUrl = new URL('/apps/sociallogin/custom_oauth2/elkdonis', nextcloudUrl);
  socialLoginUrl.searchParams.set('login_redirect_url', talkUrl);

  const response = NextResponse.redirect(socialLoginUrl);

  // Set JWT cookie for OIDC
  response.cookies.set('eac_user_jwt', userToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  });

  // Set timestamp cookie to track OAuth completion
  // This will be read on the next request to skip OAuth
  response.cookies.set('eac_nc_oauth_ts', now.toString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 120, // 2 minutes - short window to avoid stale sessions
    path: '/',
  });

  console.log('[talk/join] SSO flow initiated, will set timestamp cookie');
  return response;
}

