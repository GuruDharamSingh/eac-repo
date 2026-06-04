import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';
import { db } from '@elkdonis/db';
import { SignJWT } from 'jose';

/**
 * GET /api/talk/join?token=ROOM_TOKEN
 *
 * SSO bridge from IG into a Nextcloud Talk room.
 *
 * Flow:
 *  1. Verify user is logged in to IG.
 *  2. Verify user is synced to Nextcloud (has credentials).
 *  3. Sign a short-lived JWT and set it as eac_user_jwt cookie (same domain as
 *     our OIDC authorize endpoint — no cross-origin cookie problem).
 *  4. Redirect to Nextcloud sociallogin, which starts the OAuth2 flow back to
 *     our /api/oidc/authorize endpoint. The authorize reads the cookie, issues
 *     an auth code, and Nextcloud logs the user in.
 *  5. After auth, Nextcloud respects login_redirect_url and lands on the Talk room.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Missing room token' }, { status: 400 });
  }

  const session = await getServerSession();
  if (!session.user) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('returnTo', req.url);
    return NextResponse.redirect(loginUrl);
  }

  const [user] = await db`
    SELECT id, email, display_name, nextcloud_synced, nextcloud_user_id
    FROM users WHERE id = ${session.user.id}
  `;

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (!user.nextcloud_synced || !user.nextcloud_user_id) {
    const accountUrl = new URL('/account', req.nextUrl.origin);
    accountUrl.searchParams.set('error', 'nextcloud_not_synced');
    return NextResponse.redirect(accountUrl);
  }

  const nextcloudUrl = process.env.NEXTCLOUD_PUBLIC_URL || process.env.NEXT_PUBLIC_NEXTCLOUD_URL || '';
  const talkUrl = `${nextcloudUrl}/call/${token}`;

  // If user has a recent Nextcloud session (tracked by cookie we set after SSO),
  // go directly to the Talk room — re-running sociallogin on an existing session
  // causes "this account is already connected" errors.
  const hasNcSession = req.cookies.get('eac_nc_session')?.value === '1';
  if (hasNcSession) {
    return NextResponse.redirect(talkUrl);
  }

  // Sign a 5-minute JWT — same domain as /api/oidc/authorize so the cookie
  // will be present when Nextcloud redirects the browser back to our authorize endpoint.
  const secret = new TextEncoder().encode(process.env.INTER_APP_JWT_SECRET);
  const jwt = await new SignJWT({
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

  // Redirect to Nextcloud sociallogin — it will redirect back to our authorize
  // endpoint, which reads the eac_user_jwt cookie to identify the user.
  const socialLoginUrl = new URL('/apps/sociallogin/custom_oauth2/elkdonis', nextcloudUrl);
  socialLoginUrl.searchParams.set('login_redirect_url', talkUrl);

  const response = NextResponse.redirect(socialLoginUrl);

  response.cookies.set('eac_user_jwt', jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  });

  return response;
}
