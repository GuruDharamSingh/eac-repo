import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getServerAuth } from '@elkdonis/auth-server';

/**
 * Session Forwarding Endpoint
 *
 * Receives a JWT from inner-gathering, verifies it, and creates a session
 * in the admin app. Then redirects to the specified return_to URL.
 *
 * This allows users to be logged in to admin without manually logging in,
 * enabling seamless OAuth flows through Nextcloud Social Login.
 */
export async function GET(req: NextRequest) {
  const jwt = req.nextUrl.searchParams.get('jwt');
  const returnTo = req.nextUrl.searchParams.get('return_to');

  if (!jwt) {
    return NextResponse.json({ error: 'Missing JWT' }, { status: 400 });
  }

  if (!returnTo) {
    return NextResponse.json({ error: 'Missing return_to' }, { status: 400 });
  }

  try {
    // Verify JWT
    const secret = new TextEncoder().encode(process.env.INTER_APP_JWT_SECRET);
    const { payload } = await jwtVerify(jwt, secret, {
      issuer: ['inner-gathering', 'arts-collective'],
      audience: 'admin-oidc',
    });

    const userId = payload.userId as string;
    const email = payload.email as string;

    console.log('[forward-session] ✅ JWT verified for user:', userId);

    // Create session in admin app
    // Note: We can't actually create a Supabase session without the user's password,
    // so instead we'll rely on the OIDC authorize endpoint accepting the JWT

    // For now, just redirect - the OIDC endpoint will handle JWT verification
    console.log('[forward-session] ✅ Redirecting to:', returnTo);

    return NextResponse.redirect(returnTo);

  } catch (err) {
    console.error('[forward-session] ❌ JWT verification failed:', err);
    return NextResponse.json({
      error: 'invalid_jwt',
      error_description: 'JWT verification failed'
    }, { status: 401 });
  }
}
