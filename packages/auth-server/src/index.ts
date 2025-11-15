'use server';

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function resolveSupabaseConfig() {
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const serviceKey =
    process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null;

  if (!supabaseUrl) {
    throw new Error('[auth-server] SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) is not set');
  }

  const supabaseKey = serviceKey ?? anonKey;

  if (!supabaseKey) {
    throw new Error(
      '[auth-server] Missing SUPABASE_SERVICE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) for server client'
    );
  }

  return { supabaseUrl, supabaseKey };
}

/**
 * Get Supabase client for server components
 * Must be called with cookies from next/headers
 */
export function getServerAuth(cookies: any) {
  return createServerComponentClient({ cookies });
}

/**
 * Direct Supabase client for server-side operations
 * Uses service role key if available, otherwise anon key
 */
let cachedServerClient: SupabaseClient | null = null;

export function getSupabaseServer() {
  if (!cachedServerClient) {
    const { supabaseUrl, supabaseKey } = resolveSupabaseConfig();

    // For self-hosted GoTrue, create client with custom fetch to handle path differences
    const customFetch: typeof fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

      // Remove /auth/v1 prefix for self-hosted GoTrue
      const modifiedUrl = url.replace('/auth/v1/', '/');

      console.log('[AUTH] Fetch intercept:', { original: url, modified: modifiedUrl });

      return fetch(modifiedUrl, init);
    };

    cachedServerClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: customFetch,
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
    const [user] = await db`
      SELECT is_admin FROM users WHERE id = ${userId}
    `;
    return user?.is_admin === true;
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
    return !!membership;
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
    id: string;
    email: string;
    nextcloud_user_id?: string;
    nextcloud_app_password?: string;
  } | null;
}

/**
 * Get current user session from Supabase with Nextcloud credentials
 * Works in Server Components and API Routes (Next.js 15+)
 */
export async function getServerSession(): Promise<Session> {
  try {
    const cookieStore = await cookies();
    const supabase = getServerAuth(cookieStore);

    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session?.user) {
      return { user: null };
    }

    // Fetch user from database to get Nextcloud credentials
    const { db } = await import('@elkdonis/db');
    const [user] = await db`
      SELECT id, email, nextcloud_user_id, nextcloud_app_password
      FROM users
      WHERE id = ${session.user.id}
    `;

    return {
      user: user ? {
        id: user.id,
        email: user.email,
        nextcloud_user_id: user.nextcloud_user_id,
        nextcloud_app_password: user.nextcloud_app_password,
      } : null,
    };

  } catch (error) {
    console.error('Error getting server session:', error);
    return { user: null };
  }
}

// Export API route handlers
export * from './api-routes';
