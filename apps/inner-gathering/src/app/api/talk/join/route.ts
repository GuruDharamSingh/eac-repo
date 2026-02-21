import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';
import { db } from '@elkdonis/db';
import { SignJWT } from 'jose';

/**
 * Talk Room Join Redirect
 *
 * Creates a signed JWT with user identity, then redirects to Nextcloud Talk via sociallogin SSO.
 * The JWT allows the admin OIDC endpoint to authenticate the user without requiring them
 * to be logged in to the admin app.
 *
 * Usage: /api/talk/join?token=ROOM_TOKEN
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

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
    SELECT id, email, display_name, nextcloud_synced, nextcloud_user_id
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
    .setExpirationTime('5m') // Short-lived token
    .setIssuer('inner-gathering')
    .setAudience('admin-oidc')
    .sign(secret);

  const nextcloudUrl = process.env.NEXTCLOUD_PUBLIC_URL || 'http://localhost:8080';
  const talkUrl = `${nextcloudUrl}/call/${token}`;

  // Redirect to Social Login - set JWT as cookie so OIDC endpoint can read it
  const socialLoginUrl = new URL('/apps/sociallogin/custom_oauth2/elkdonis', nextcloudUrl);
  socialLoginUrl.searchParams.set('redirect_url', talkUrl);

  const response = NextResponse.redirect(socialLoginUrl);

  // Set JWT as httpOnly cookie (5 min expiry, same as JWT)
  response.cookies.set('eac_user_jwt', userToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300, // 5 minutes
    path: '/',
  });

  console.log('[talk/join] Set JWT cookie, redirecting to Social Login');
  return response;
}
