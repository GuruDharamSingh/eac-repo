import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@elkdonis/db';
import { get, setex } from '@elkdonis/redis';

export const dynamic = 'force-dynamic';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is required');
  return new TextEncoder().encode(secret);
}

const JWT_SECRET = getJwtSecret();

const CACHE_TTL = 60;

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return req.nextUrl.searchParams.get('access_token');
}

export async function GET(req: NextRequest) {
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const token = getToken(req);

  if (!token) {
    // Hybridauth bug: second request arrives with no token — serve cached response
    try {
      const userId = await get(`oidc:ip2user:${clientIP}`);
      if (userId) {
        const cached = await get(`oidc:userinfo:${userId}`);
        if (cached) return NextResponse.json(JSON.parse(cached));
      }
    } catch { /* Redis unavailable — fall through */ }
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.sub;
    if (!userId) throw new Error('No sub in token');

    const [byId] = await db`SELECT id, email, display_name FROM users WHERE id = ${userId}`;
    let user = byId;
    if (!user) {
      try {
        const [byAuth] = await db`SELECT id, email, display_name FROM users WHERE auth_user_id = ${userId}`;
        user = byAuth;
      } catch { /* ignore */ }
    }
    if (!user) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });

    const data = {
      sub: user.id,
      id: user.id,
      name: user.display_name,
      email: user.email,
      email_verified: true,
      preferred_username: user.id,
    };

    try {
      await setex(`oidc:userinfo:${user.id}`, CACHE_TTL, JSON.stringify(data));
      await setex(`oidc:ip2user:${clientIP}`, CACHE_TTL, user.id);
    } catch { /* Redis unavailable — non-fatal */ }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[userinfo] Token error:', err);
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }
}
