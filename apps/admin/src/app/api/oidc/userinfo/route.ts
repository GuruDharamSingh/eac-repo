import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@elkdonis/db';
import { createClient, RedisClientType } from 'redis';

// Configuration - JWT_SECRET is required, no fallbacks for security
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return new TextEncoder().encode(secret);
}

const JWT_SECRET = getJwtSecret();

// Redis client for caching userinfo responses
// This handles the Hybridauth bug where the second request has an empty Bearer token
// Cache by user ID (not IP) to prevent serving wrong user's data
const CACHE_TTL_SECONDS = 60; // Enough time for full OAuth flow
const CACHE_PREFIX = 'oidc:userinfo:';
const IP_TO_USER_PREFIX = 'oidc:ip2user:';

// Use globalThis to persist Redis client across hot reloads in Next.js dev mode
const globalRedis = globalThis as typeof globalThis & {
  __redisClient?: RedisClientType;
  __redisConnecting?: boolean;
};

async function getRedisClient(): Promise<RedisClientType> {
  if (globalRedis.__redisClient?.isOpen) {
    return globalRedis.__redisClient;
  }
  
  // Prevent multiple simultaneous connection attempts
  if (globalRedis.__redisConnecting) {
    // Wait a bit and retry
    await new Promise(resolve => setTimeout(resolve, 100));
    return getRedisClient();
  }
  
  globalRedis.__redisConnecting = true;
  try {
    const client = createClient({
      url: process.env.REDIS_URL || 'redis://eac-redis:6379'
    });
    client.on('error', (err) => console.error('[userinfo] Redis error:', err));
    await client.connect();
    globalRedis.__redisClient = client as RedisClientType;
    console.log('[userinfo] Redis connected');
    return globalRedis.__redisClient;
  } finally {
    globalRedis.__redisConnecting = false;
  }
}

async function getCachedResponse(clientIP: string): Promise<object | null> {
  try {
    const redis = await getRedisClient();
    // First, look up which user ID was last used from this IP (very short-lived)
    const userId = await redis.get(IP_TO_USER_PREFIX + clientIP);
    if (!userId) {
      console.log('[userinfo] No recent user mapping for IP:', clientIP);
      return null;
    }
    // Then get the cached response for that user
    const cached = await redis.get(CACHE_PREFIX + userId);
    if (cached) {
      console.log('[userinfo] Found cached response for user:', userId, 'from IP:', clientIP);
      return JSON.parse(cached);
    }
  } catch (err) {
    console.error('[userinfo] Redis get error:', err);
  }
  return null;
}

async function setCachedResponse(clientIP: string, userId: string, data: object): Promise<void> {
  try {
    const redis = await getRedisClient();
    // Store the user's response data keyed by user ID
    await redis.setEx(CACHE_PREFIX + userId, CACHE_TTL_SECONDS, JSON.stringify(data));
    // Also map this IP to this user ID (very short-lived, just for the duplicate request)
    await redis.setEx(IP_TO_USER_PREFIX + clientIP, CACHE_TTL_SECONDS, userId);
    console.log('[userinfo] Cached response for user:', userId, 'IP:', clientIP);
  } catch (err) {
    console.error('[userinfo] Redis set error:', err);
  }
}

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
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

  const token = getTokenFromRequest(req);

  if (!token) {
    // Check if we have a recent cached response for this client
    // This handles the Hybridauth bug where the second request has an empty token
    const cached = await getCachedResponse(clientIP);
    if (cached) {
      console.log('[userinfo] Using cached response due to empty token');
      return NextResponse.json(cached);
    }

    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

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
    const responseData = {
      sub: user.id,
      id: user.id,
      name: user.display_name,
      email: user.email,
      email_verified: true,
      preferred_username: user.id // Stable Nextcloud userid
    };

    // Cache the response for a few seconds to handle Hybridauth's duplicate request bug
    // Use user ID as key so different users don't get each other's cached data
    await setCachedResponse(clientIP, user.id, responseData);

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('UserInfo Error:', error);
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }
}
