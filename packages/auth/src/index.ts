import { createClient } from '@supabase/supabase-js';
import { createClientComponentClient, createServerComponentClient } from '@supabase/auth-helpers-nextjs';

// Auth configuration shared by all apps
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Get Supabase client for client components
 */
export function getClientAuth() {
  return createClientComponentClient();
}

/**
 * Get Supabase client for server components
 */
export function getServerAuth(cookies: any) {
  return createServerComponentClient({ cookies });
}

/**
 * Direct Supabase client (for edge cases)
 */
export function getSupabase() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Check if user has access to an organization
 */
export async function checkOrgAccess(userId: string, orgId: string): Promise<boolean> {
  // This will check against our database
  // For now, we'll implement this in each app as needed
  return true;
}

/**
 * Authentication hooks and utilities
 */
export { useUser, useSession, useSupabaseClient } from '@supabase/auth-helpers-react';

/**
 * Auth provider for wrapping apps
 */
export { SessionContextProvider } from '@supabase/auth-helpers-react';