import Redis from 'ioredis';

// Singleton Redis client
let redisClient: Redis | null = null;

/**
 * Get or create Redis client singleton
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    console.log('[redis] Connecting to:', redisUrl);

    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
    });

    redisClient.on('error', (err) => {
      console.error('[redis] Connection error:', err.message);
    });

    redisClient.on('connect', () => {
      console.log('[redis] Connected successfully');
    });
  }

  return redisClient;
}

/**
 * Close Redis connection (for cleanup)
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

// ============================================
// Basic Key-Value Operations
// ============================================

/**
 * Get a value from Redis
 */
export async function get(key: string): Promise<string | null> {
  const client = getRedisClient();
  return client.get(key);
}

/**
 * Set a value in Redis
 */
export async function set(key: string, value: string): Promise<void> {
  const client = getRedisClient();
  await client.set(key, value);
}

/**
 * Set a value with expiration (seconds)
 */
export async function setex(key: string, seconds: number, value: string): Promise<void> {
  const client = getRedisClient();
  await client.setex(key, seconds, value);
}

/**
 * Delete a key
 */
export async function del(key: string): Promise<void> {
  const client = getRedisClient();
  await client.del(key);
}

/**
 * Check if key exists
 */
export async function exists(key: string): Promise<boolean> {
  const client = getRedisClient();
  const result = await client.exists(key);
  return result === 1;
}

/**
 * Get JSON value
 */
export async function getJSON<T>(key: string): Promise<T | null> {
  const value = await get(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Set JSON value
 */
export async function setJSON<T>(key: string, value: T): Promise<void> {
  await set(key, JSON.stringify(value));
}

/**
 * Set JSON value with expiration
 */
export async function setJSONex<T>(key: string, seconds: number, value: T): Promise<void> {
  await setex(key, seconds, JSON.stringify(value));
}

// ============================================
// Session Management
// ============================================

const SESSION_PREFIX = 'session:';
const SESSION_TTL = 60 * 15; // 15 minutes default

export interface CachedSession {
  userId: string;
  email: string;
  displayName?: string;
  nextcloudUserId?: string;
  nextcloudAppPassword?: string;
  expiresAt: number;
}

/**
 * Get session from cache
 */
export async function getSession(sessionToken: string): Promise<CachedSession | null> {
  const key = SESSION_PREFIX + sessionToken;
  return getJSON<CachedSession>(key);
}

/**
 * Cache a session
 */
export async function setSession(sessionToken: string, session: CachedSession, ttlSeconds?: number): Promise<void> {
  const key = SESSION_PREFIX + sessionToken;
  await setJSONex(key, ttlSeconds || SESSION_TTL, session);
}

/**
 * Delete session from cache
 */
export async function deleteSession(sessionToken: string): Promise<void> {
  const key = SESSION_PREFIX + sessionToken;
  await del(key);
}

/**
 * Invalidate all sessions for a user (e.g., on logout everywhere)
 * Note: This requires scanning, use sparingly
 */
export async function invalidateUserSessions(userId: string): Promise<number> {
  const client = getRedisClient();
  const keys = await client.keys(`${SESSION_PREFIX}*`);
  let deleted = 0;

  for (const key of keys) {
    const session = await getJSON<CachedSession>(key);
    if (session?.userId === userId) {
      await del(key);
      deleted++;
    }
  }

  return deleted;
}

// ============================================
// Generic Cache Helpers
// ============================================

const CACHE_PREFIX = 'cache:';

/**
 * Get or set cache value with loader function
 */
export async function getOrSet<T>(
  key: string,
  loader: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  const cacheKey = CACHE_PREFIX + key;
  const cached = await getJSON<T>(cacheKey);

  if (cached !== null) {
    return cached;
  }

  const value = await loader();
  await setJSONex(cacheKey, ttlSeconds, value);
  return value;
}

/**
 * Invalidate cache key
 */
export async function invalidateCache(key: string): Promise<void> {
  const cacheKey = CACHE_PREFIX + key;
  await del(cacheKey);
}

// ============================================
// Health Check
// ============================================

/**
 * Check if Redis is connected and responsive
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await client.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

// Export the Redis class for advanced usage
export { Redis };
