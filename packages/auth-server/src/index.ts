'use server';

import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function resolveSupabaseUrl(): string {
  return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
}

function resolveSupabaseAnonKey(): string {
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!key) {
    throw new Error('[auth-server] SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) is not set');
  }
  return key;
}

function resolveSupabaseServiceKey(): string {
  const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!key) {
    throw new Error('[auth-server] SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY) is not set');
  }
  return key;
}

function resolveStorageKey(): string {
  return process.env.SUPABASE_AUTH_STORAGE_KEY || 'sb-eac-auth';
}

function shouldStripAuthV1(supabaseUrl: string): boolean {
  try {
    const url = new URL(supabaseUrl);
    if (process.env.SUPABASE_GOTRUE_DIRECT === 'true') return true;
    if (url.port === '9999') return true;
    if (url.hostname === 'supabase-auth') return true;
    return false;
  } catch {
    return false;
  }
}

function makeSupabaseFetch(supabaseUrl: string): typeof fetch {
  if (!shouldStripAuthV1(supabaseUrl)) return fetch;

  return async (input, init) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    // Remove /auth/v1 prefix for direct, self-hosted GoTrue.
    const modifiedUrl = url.replace('/auth/v1/', '/');
    return fetch(modifiedUrl, init);
  };
}

export function resolveSupabasePublicConfig() {
  const supabaseUrl = resolveSupabaseUrl();
  if (!supabaseUrl) {
    throw new Error('[auth-server] SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) is not set');
  }

  return {
    supabaseUrl,
    supabaseAnonKey: resolveSupabaseAnonKey(),
    storageKey: resolveStorageKey(),
    fetch: makeSupabaseFetch(supabaseUrl),
  };
}

export function resolveSupabaseAdminConfig() {
  const supabaseUrl = resolveSupabaseUrl();
  if (!supabaseUrl) {
    throw new Error('[auth-server] SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) is not set');
  }

  return {
    supabaseUrl,
    supabaseServiceKey: resolveSupabaseServiceKey(),
    storageKey: resolveStorageKey(),
    fetch: makeSupabaseFetch(supabaseUrl),
  };
}

/**
 * Get Supabase client for server components (Next.js 15 compatible)
 * Automatically handles async cookies
 */
export async function getServerAuth() {
  const { supabaseUrl, supabaseAnonKey, storageKey, fetch } = resolveSupabasePublicConfig();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
    auth: {
      storageKey,
    },
    global: {
      fetch,
    },
  });
}

/**
 * Direct Supabase client for server-side operations
 * Uses service role key (admin operations)
 */
let cachedServerClient: SupabaseClient | null = null;

export function getSupabaseServer() {
  if (!cachedServerClient) {
    const { supabaseUrl, supabaseServiceKey, storageKey, fetch } = resolveSupabaseAdminConfig();

    cachedServerClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        storageKey,
        autoRefreshToken: true,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch,
      },
    });
  }

  return cachedServerClient;
}

/**
 * Check if user is admin (superadmin access)
 * Requires database access
 */
export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const { db } = await import('@elkdonis/db');
    const [byId] = await db`
      SELECT is_admin FROM users WHERE id = ${userId}
    `;
    if (byId) return byId.is_admin === true;

    try {
      const [byAuthUserId] = await db`
        SELECT is_admin FROM users WHERE auth_user_id = ${userId}
      `;
      return byAuthUserId?.is_admin === true;
    } catch (_err) {
      return false;
    }
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Middleware helper: Require admin access
 * Throws error if user is not admin
 */
export async function requireAdmin(userId: string): Promise<void> {
  const admin = await isAdmin(userId);
  if (!admin) {
    throw new Error('Admin access required');
  }
}

/**
 * Check if user has access to an organization
 */
export async function checkOrgAccess(userId: string, orgId: string): Promise<boolean> {
  try {
    const { db } = await import('@elkdonis/db');
    const [membership] = await db`
      SELECT 1 FROM user_organizations
      WHERE user_id = ${userId} AND org_id = ${orgId}
      LIMIT 1
    `;
    if (membership) return true;

    try {
      const [mapped] = await db`
        SELECT uo.user_id
        FROM users u
        JOIN user_organizations uo ON uo.user_id = u.id
        WHERE u.auth_user_id = ${userId} AND uo.org_id = ${orgId}
        LIMIT 1
      `;
      return !!mapped;
    } catch (_err) {
      return false;
    }
  } catch (error) {
    console.error('Error checking org access:', error);
    return false;
  }
}

/**
 * Session type returned by getServerSession
 */
export interface Session {
  user: {
    /**
     * Supabase Auth user id (GoTrue UUID).
     * Kept as `id` for backwards compatibility across apps.
     */
    id: string;
    auth_user_id: string;
    /**
     * Internal database user id (may differ if you decouple users from auth.users).
     * When not present, assume it matches `auth_user_id`.
     */
    db_user_id?: string;
    email: string;
    nextcloud_user_id?: string;
    nextcloud_app_password?: string;
  } | null;
}

// Redis session cache TTL (10 minutes)
const SESSION_CACHE_TTL = 60 * 10;

/**
 * Get current user session from Supabase with Nextcloud credentials
 * Works in Server Components and API Routes (Next.js 15+)
 *
 * Uses Redis caching to avoid hitting Supabase/DB on every request.
 */
export async function getServerSession(): Promise<Session> {
  try {
    const supabase = await getServerAuth();

    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session?.user) {
      return { user: null };
    }

    const authUserId = session.user.id;

    // Try Redis cache first
    try {
      const { getSession: getCachedSession, setSession: setCachedSession } = await import('@elkdonis/redis');

      // Use access_token hash as cache key for security
      const cacheKey = `user:${authUserId}`;
      const cached = await getCachedSession(cacheKey);

      if (cached && cached.expiresAt > Date.now()) {
        return {
          user: {
            id: authUserId,
            auth_user_id: authUserId,
            db_user_id: cached.userId,
            email: cached.email,
            nextcloud_user_id: cached.nextcloudUserId,
            nextcloud_app_password: cached.nextcloudAppPassword,
          },
        };
      }
    } catch (redisError) {
      // Redis not available, continue without cache
      console.warn('[auth-server] Redis cache unavailable:', (redisError as Error).message);
    }

    // Cache miss or expired - fetch from database
    const { db } = await import('@elkdonis/db');

    // Fetch user from database to get Nextcloud credentials.
    // Supports both schemas:
    // - users.id == auth.users.id
    // - users.auth_user_id == auth.users.id (with separate internal users.id)
    type DbUserRow = {
      id: string;
      email: string | null;
      nextcloud_user_id: string | null;
      nextcloud_app_password: string | null;
    };

    let user: DbUserRow | undefined;

    const byIdRows = await db<DbUserRow[]>`
      SELECT id, email, nextcloud_user_id, nextcloud_app_password
      FROM users
      WHERE id = ${authUserId}
    `;
    user = byIdRows[0] ?? undefined;

    if (!user) {
      try {
        const byAuthUserIdRows = await db<DbUserRow[]>`
          SELECT id, email, nextcloud_user_id, nextcloud_app_password
          FROM users
          WHERE auth_user_id = ${authUserId}
        `;
        user = byAuthUserIdRows[0] ?? undefined;
      } catch (_err) {
        // Ignore if auth_user_id column doesn't exist in this schema.
      }
    }

    // Cache the session in Redis
    if (user) {
      try {
        const { setSession: setCachedSession } = await import('@elkdonis/redis');
        const cacheKey = `user:${authUserId}`;

        await setCachedSession(cacheKey, {
          userId: user.id,
          email: user.email || session.user.email || '',
          displayName: undefined,
          nextcloudUserId: user.nextcloud_user_id || undefined,
          nextcloudAppPassword: user.nextcloud_app_password || undefined,
          expiresAt: Date.now() + (SESSION_CACHE_TTL * 1000),
        }, SESSION_CACHE_TTL);
      } catch (redisError) {
        // Redis not available, continue without cache
        console.warn('[auth-server] Failed to cache session:', (redisError as Error).message);
      }
    }

    return {
      user: user ? {
        id: authUserId,
        auth_user_id: authUserId,
        db_user_id: user.id,
        email: user.email || session.user.email || '',
        nextcloud_user_id: user.nextcloud_user_id,
        nextcloud_app_password: user.nextcloud_app_password,
      } : null,
    };

  } catch (error) {
    console.error('Error getting server session:', error);
    return { user: null };
  }
}

/**
 * Invalidate session cache for a user (call on logout)
 */
export async function invalidateSessionCache(userId: string): Promise<void> {
  try {
    const { deleteSession } = await import('@elkdonis/redis');
    const cacheKey = `user:${userId}`;
    await deleteSession(cacheKey);
  } catch (error) {
    console.warn('[auth-server] Failed to invalidate session cache:', (error as Error).message);
  }
}

// Export API route handlers
export * from './api-routes';
