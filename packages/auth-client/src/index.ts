'use client';

/**
 * Client-side auth helpers
 * These use API routes to avoid CORS issues
 */

import { useEffect, useState } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  display_name?: string;
}

export interface AuthSession {
  user: AuthUser | null;
}

/**
 * Login with email and password
 */
export async function signInWithPassword(email: string, password: string): Promise<{ user: AuthUser | null; error: string | null }> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { user: null, error: data.error || 'Login failed' };
    }

    return { user: data.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message || 'Network error' };
  }
}

/**
 * Sign up with email and password
 */
export async function signUp(email: string, password: string, displayName?: string): Promise<{ user: AuthUser | null; error: string | null }> {
  try {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { user: null, error: data.error || 'Signup failed' };
    }

    return { user: data.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message || 'Network error' };
  }
}

/**
 * Sign out
 */
export async function signOut(): Promise<{ error: string | null }> {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
    });

    if (!response.ok) {
      const data = await response.json();
      return { error: data.error || 'Logout failed' };
    }

    return { error: null };
  } catch (error: any) {
    return { error: error.message || 'Network error' };
  }
}

/**
 * Get current session
 */
export async function getSession(): Promise<AuthSession> {
  try {
    const response = await fetch('/api/auth/session');
    const data = await response.json();

    return { user: data.user || null };
  } catch (error) {
    return { user: null };
  }
}

/**
 * React hook to get current session
 */
export function useSession() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession().then((session) => {
      setSession(session);
      setLoading(false);
    });
  }, []);

  return { session, loading };
}

/**
 * React hook to get current user
 */
export function useUser() {
  const { session, loading } = useSession();
  return { user: session?.user || null, loading };
}
