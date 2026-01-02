import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@elkdonis/db';

// Use same default as docker-compose.yml
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-super-secret-jwt-token-with-at-least-32-characters');

/**
 * Get token from request - supports multiple methods:
 * 1. Authorization: Bearer <token> header (OAuth2 standard)
 * 2. access_token query parameter (OAuth2 alternative)
 */
function getTokenFromRequest(req: NextRequest): string | null {
  // Try Authorization header first (standard)
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  // Try query parameter (some OAuth2 clients use this)
  const queryToken = req.nextUrl.searchParams.get('access_token');
  if (queryToken) {
    return queryToken;
  }

  return null;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const queryToken = req.nextUrl.searchParams.get('access_token');

  console.log('[userinfo] Request URL:', req.url);
  console.log('[userinfo] Auth header present:', !!authHeader, authHeader ? authHeader.substring(0, 30) + '...' : 'none');
  console.log('[userinfo] Query token present:', !!queryToken);
  console.log('[userinfo] All query params:', Object.fromEntries(req.nextUrl.searchParams));

  const token = getTokenFromRequest(req);

  if (!token) {
    console.log('[userinfo] No token found in request');
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  console.log('[userinfo] Token length:', token.length);

  try {
    // 1. Verify Token - don't check issuer since we control the secret
    // The issuer varies between localhost/docker internal URLs
    let payload;
    try {
      const result = await jwtVerify(token, JWT_SECRET);
      payload = result.payload;
    } catch (verifyErr) {
      console.error('JWT verification failed:', verifyErr);
      throw new Error('Token verification failed');
    }
    const userId = payload.sub;

    if (!userId) {
      throw new Error('Invalid token payload');
    }

    // 2. Get User Data
    const [byId] = await db`
      SELECT id, email, display_name FROM users WHERE id = ${userId}
    `;
    let user = byId;
    if (!user) {
      try {
        const [byAuthUserId] = await db`
          SELECT id, email, display_name FROM users WHERE auth_user_id = ${userId}
        `;
        user = byAuthUserId;
      } catch (_err) {
        // ignore if auth_user_id column doesn't exist
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
    }

    // 3. Return OAuth2/OIDC Profile
    // Include both 'sub' (OIDC standard) and 'id' (some OAuth2 clients expect this)
    return NextResponse.json({
      sub: user.id,
      id: user.id,
      name: user.display_name,
      email: user.email,
      email_verified: true,
      preferred_username: user.id // Stable Nextcloud userid
    });

  } catch (error) {
    console.error('UserInfo Error:', error);
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }
}
