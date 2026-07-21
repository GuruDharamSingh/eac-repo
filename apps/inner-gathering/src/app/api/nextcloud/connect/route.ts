import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';
import { db } from '@elkdonis/db';
import { SignJWT } from 'jose';

/**
 * GET /api/nextcloud/connect
 *
 * Self-service Nextcloud provisioning: sends the user through the same SSO
 * bridge as talk/join, but standalone (not tied to a room token). Nextcloud
 * creates the account itself on first login — this is the one path that
 * isn't blocked by Nextcloud's admin-API password-confirmation gate, since
 * it's the user's own live session doing the creating.
 *
 * /api/oidc/authorize records the resulting nextcloud_synced state once the
 * flow completes.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session.user) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('returnTo', req.url);
    return NextResponse.redirect(loginUrl);
  }

  const [user] = await db`
    SELECT u.id, u.email, u.display_name, u.nextcloud_user_id,
           au.email_confirmed_at IS NOT NULL AS email_confirmed
    FROM users u
    LEFT JOIN auth.users au ON au.id = u.id
    WHERE u.id = ${session.user.id}
  `;
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Nextcloud accounts are only provisioned for confirmed emails — this
  // guard applies regardless of caller (confirmation-link redirect, the
  // /account fallback button, Google signup where GoTrue auto-confirms).
  if (!user.email_confirmed) {
    const accountUrl = new URL('/account', req.nextUrl.origin);
    accountUrl.searchParams.set('error', 'email_not_confirmed');
    return NextResponse.redirect(accountUrl);
  }

  const nextcloudUrl = process.env.NEXTCLOUD_PUBLIC_URL || process.env.NEXT_PUBLIC_NEXTCLOUD_URL || '';

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

  const loginUrl = new URL('/login', nextcloudUrl);
  loginUrl.searchParams.set('redirect_url', '/apps/dashboard/');

  const response = NextResponse.redirect(loginUrl);
  response.cookies.set('eac_user_jwt', jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  });
  return response;
}
