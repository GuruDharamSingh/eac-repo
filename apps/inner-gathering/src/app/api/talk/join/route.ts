import { NextRequest, NextResponse } from 'next/server';

/**
 * Talk Room Join Redirect
 *
 * Redirects to Nextcloud Talk via sociallogin SSO.
 * The OAuth2 flow will handle authentication automatically.
 *
 * Usage: /api/talk/join?token=ROOM_TOKEN
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing room token' }, { status: 400 });
  }

  const nextcloudUrl = process.env.NEXTCLOUD_PUBLIC_URL || 'http://localhost:8080';
  const talkUrl = `${nextcloudUrl}/call/${token}`;

  // Redirect through sociallogin SSO
  // This triggers OAuth2 flow which authenticates user with their app account
  const socialLoginUrl = new URL('/apps/sociallogin/custom_oauth2/elkdonis', nextcloudUrl);
  socialLoginUrl.searchParams.set('redirect_url', talkUrl);

  return NextResponse.redirect(socialLoginUrl);
}
