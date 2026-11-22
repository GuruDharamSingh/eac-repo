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
 *  1. Not logged in, or logged in but not synced to Nextcloud — send straight
 *     into the room's own guest-join screen (Nextcloud Talk supports joining
 *     public rooms by name, no account required). No forced login wall.
 *  2. Logged in AND synced — sign a short-lived JWT and set it as eac_user_jwt
 *     cookie (same domain as our OIDC authorize endpoint — no cross-origin
 *     cookie problem).
 *  3. Redirect to Nextcloud's /login, which starts the OAuth2 flow back to
 *     our /api/oidc/authorize endpoint. The authorize reads the cookie, issues
 *     an auth code, and Nextcloud logs the user in as themselves.
 *  4. After auth, Nextcloud respects redirect_url and lands on the Talk room.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Missing room token' }, { status: 400 });
  }

  const nextcloudUrl = process.env.NEXTCLOUD_PUBLIC_URL || process.env.NEXT_PUBLIC_NEXTCLOUD_URL || '';
  const talkPath = `/call/${token}`;
  const guestJoin = () => NextResponse.redirect(new URL(talkPath, nextcloudUrl));

  const session = await getServerSession();
  if (!session.user) {
    // Not logged into the app at all — still let them into the room as a guest.
    return guestJoin();
  }

  const [user] = await db`
    SELECT id, email, display_name, nextcloud_synced, nextcloud_user_id
    FROM users WHERE id = ${session.user.id}
  `;

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // No Nextcloud account yet — same guest fallback. Once they sync, the SSO
  // branch below takes over and joins them as their real account instead.
  if (!user.nextcloud_synced || !user.nextcloud_user_id) {
    return guestJoin();
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

  // Route through Nextcloud's /login rather than the sociallogin endpoint:
  //  - live NC session  → /login redirects straight to redirect_url (the Talk
  //    room). Hitting sociallogin with an existing session errors with
  //    "this account is already connected" and strands the user.
  //  - no NC session    → sociallogin's auto_login=1 forwards the login page to
  //    our OIDC authorize endpoint (preserving redirect_url), which reads the
  //    eac_user_jwt cookie and completes SSO into the room.
  const loginUrl = new URL('/login', nextcloudUrl);
  loginUrl.searchParams.set('redirect_url', talkPath);

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
