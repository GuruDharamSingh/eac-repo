import { createClient } from '@supabase/supabase-js';

// REST API URL (PostgREST on port 9998)
const supabaseRestUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// Auth URL (GoTrue on port 9999)
const supabaseAuthUrl =
  process.env.NEXT_PUBLIC_SUPABASE_AUTH_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Custom fetch to route auth requests to the correct service
const customFetch: typeof fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  // Route auth requests to port 9999, everything else to port 9998
  if (url.includes('/auth/')) {
    const authUrl = url.replace(supabaseRestUrl, supabaseAuthUrl);
    return fetch(authUrl, init);
  }

  return fetch(input, init);
};

export const supabase = createClient(supabaseRestUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: customFetch,
  },
});
