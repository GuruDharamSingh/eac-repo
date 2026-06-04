'use client';

/**
 * Client-side auth helpers
 * These use API routes to avoid CORS issues
 */

import { useCallback, useEffect, useState } from 'react';

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
export async function signUp(
  email: string,
  password: string,
  displayName?: string,
  interests?: string[],
  turnstileToken?: string
): Promise<{ user: AuthUser | null; error: string | null }> {
  try {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName, interests, turnstileToken }),
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
 * Begin Google OAuth (Option A — raw GoTrue path).
 *
 * GoTrue is exposed without the standard Supabase `/auth/v1` Kong prefix, so we
 * redirect the browser straight to its root `/authorize` endpoint rather than
 * using supabase-js (which would call the non-existent `/auth/v1/authorize`).
 * After Google → GoTrue, the user returns to `redirectTo` (defaults to the
 * current origin).
 *
 * NOTE: this only *initiates* the flow. Completing a logged-in session needs a
 * callback handler that converts GoTrue's returned tokens into the app's
 * `sb-eac-auth` cookies — see eac-launch-status notes (not yet implemented).
 */
export function signInWithGoogle(redirectTo?: string): void {
  if (typeof window === 'undefined') return;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) {
    console.error('[auth] NEXT_PUBLIC_SUPABASE_URL is not set; cannot start Google sign-in.');
    return;
  }
  const dest = redirectTo ?? window.location.origin;
  window.location.href =
    `${base.replace(/\/$/, '')}/authorize?provider=google&redirect_to=${encodeURIComponent(dest)}`;
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

/* ------------------------------------------------------------------ *
 * Universal auth form logic
 *
 * `useAuthForm` is a headless hook: it owns the state and behaviour of a
 * sign-in / sign-up form (mode toggle, field values, validation, submit,
 * error handling) but renders no UI of its own. Every app — Mantine or
 * shadcn, branded login page or quick authwall modal — can share this
 * logic while keeping its own look. See `<AuthForm>` in `@elkdonis/ui`
 * for a default-styled Mantine implementation built on top of it.
 * ------------------------------------------------------------------ */

export type AuthMode = 'signin' | 'signup';

/** Payload passed to `onSuccess` after a completed sign-in or sign-up. */
export interface AuthSuccess {
  user: AuthUser;
  mode: AuthMode;
}

export interface UseAuthFormOptions {
  /** Mode the form starts in. Default `'signin'`. */
  initialMode?: AuthMode;
  /** Collect an optional display name field on signup. Default `false`. */
  collectDisplayName?: boolean;
  /** Minimum password length enforced before submit. Default `6`. */
  minPasswordLength?: number;
  /**
   * Called after a successful sign-in or sign-up. Do redirects, org joins,
   * `router.refresh()`, etc. here. If it throws, the message is surfaced
   * on the form as an error.
   */
  onSuccess?: (result: AuthSuccess) => void | Promise<void>;
}

export interface UseAuthFormReturn {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  toggleMode: () => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  displayName: string;
  setDisplayName: (value: string) => void;
  interests: string[];
  setInterests: (value: string[]) => void;
  /** Set by the Turnstile widget on success; cleared on expire/error. */
  turnstileToken: string | null;
  setTurnstileToken: (token: string | null) => void;
  error: string | null;
  setError: (value: string | null) => void;
  submitting: boolean;
  /**
   * Submit handler. Pass it straight to `<form onSubmit>` — it calls
   * `preventDefault()` for you when given the event.
   */
  submit: (event?: { preventDefault?: () => void }) => Promise<void>;
}

const AUTH_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Headless sign-in / sign-up form logic.
 *
 * @example
 * const f = useAuthForm({ onSuccess: () => router.push('/dashboard') });
 * <form onSubmit={f.submit}>
 *   <input value={f.email} onChange={(e) => f.setEmail(e.target.value)} />
 *   ...
 * </form>
 */
export function useAuthForm(options: UseAuthFormOptions = {}): UseAuthFormReturn {
  const {
    initialMode = 'signin',
    collectDisplayName = false,
    minPasswordLength = 6,
    onSuccess,
  } = options;

  const [mode, setModeState] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setMode = useCallback((next: AuthMode) => {
    setModeState(next);
    setError(null);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((m) => (m === 'signin' ? 'signup' : 'signin'));
    setError(null);
  }, []);

  const submit = useCallback(
    async (event?: { preventDefault?: () => void }) => {
      event?.preventDefault?.();
      setError(null);

      const trimmedEmail = email.trim();
      if (!AUTH_EMAIL_RE.test(trimmedEmail)) {
        setError('Enter a valid email address.');
        return;
      }
      if (password.length < minPasswordLength) {
        setError(`Password must be at least ${minPasswordLength} characters.`);
        return;
      }

      setSubmitting(true);
      try {
        const result =
          mode === 'signup'
            ? await signUp(
                trimmedEmail,
                password,
                collectDisplayName && displayName.trim()
                  ? displayName.trim()
                  : undefined,
                interests.length > 0 ? interests : undefined,
                turnstileToken ?? undefined
              )
            : await signInWithPassword(trimmedEmail, password);

        if (result.error) {
          setError(result.error);
          return;
        }
        if (!result.user) {
          setError('Something went wrong. Please try again.');
          return;
        }

        await onSuccess?.({ user: result.user, mode });
      } catch (err: any) {
        setError(err?.message || 'Network error. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [
      mode,
      email,
      password,
      displayName,
      interests,
      turnstileToken,
      collectDisplayName,
      minPasswordLength,
      onSuccess,
    ]
  );

  return {
    mode,
    setMode,
    toggleMode,
    email,
    setEmail,
    password,
    setPassword,
    displayName,
    setDisplayName,
    interests,
    setInterests,
    turnstileToken,
    setTurnstileToken,
    error,
    setError,
    submitting,
    submit,
  };
}
