import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';
import { db } from '@elkdonis/db';
import { SignJWT } from 'jose';

/**
 * Talk Room Join Redirect
 *
 * Two paths:
 * 1. Direct redirect to Talk room URL (if user likely has NC session)
 * 2. SSO via sociallogin (first-time, triggered by ?sso=1 param)
 *
 * If the user has no NC session, Nextcloud will show its login page which
 * includes the sociallogin "Elkdonis" button for one-click SSO.
 *
 * Usage: /api/talk/join?token=ROOM_TOKEN
 *        /api/talk/join?token=ROOM_TOKEN&sso=1  (force SSO path)
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const forceSSO = req.nextUrl.searchParams.get('sso') === '1';

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

  const nextcloudUrl = process.env.NEXTCLOUD_PUBLIC_URL || 'https://cloud.elkdonis-arts.org';
  const talkUrl = `${nextcloudUrl}/call/${token}`;

  // Default path: redirect directly to Talk room URL.
  // If user has an active NC session (from previous sociallogin or direct login),
  // the Talk room loads immediately — no SSO overhead.
  // If no NC session, NC shows its login page which has the sociallogin button.
  if (!forceSSO) {
    console.log('[talk/join] Direct redirect to Talk room:', talkUrl);
    return NextResponse.redirect(talkUrl);
  }

  // SSO path: create JWT and redirect through sociallogin for first-time auth.
  // This is triggered by ?sso=1 or can be used as a fallback.
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

  const socialLoginUrl = new URL('/apps/sociallogin/custom_oauth2/elkdonis', nextcloudUrl);
  socialLoginUrl.searchParams.set('redirect_url', talkUrl);

  const response = NextResponse.redirect(socialLoginUrl);

  response.cookies.set('eac_user_jwt', userToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  });

  console.log('[talk/join] SSO redirect via sociallogin → Talk room:', socialLoginUrl.toString());
  return response;
}
