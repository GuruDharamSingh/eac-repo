'use client';

/**
 * BaroqueSignup
 *
 * Mantine-free signup / sign-in card with a CSS-only gilt baroque frame.
 * Built on the headless `useAuthForm` hook from `@elkdonis/auth-client`
 * so it shares behaviour with the existing AuthForm. Used on the landing
 * page (`apps/elkdonis-arts-collective`) and on inner-gathering /login.
 *
 * Requires the consuming app to import:
 *   import '@elkdonis/ui/eac-theme.css';
 * and to serve `/fonts/RELIGATH-Demo.otf` from its public folder.
 */

import { useState, type ReactNode } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';
import {
  useAuthForm,
  signInWithGoogle,
  type AuthMode,
  type AuthSuccess,
} from '@elkdonis/auth-client';

export interface BaroqueSignupProps {
  initialMode?: AuthMode;
  /** Heading. Defaults to "Join the Collective" / "Welcome Back" by mode. */
  title?: ReactNode;
  /** Optional contextual line shown under the heading. */
  subtitle?: ReactNode;
  /** Called after a successful sign-in or sign-up. Do redirects here. */
  onSuccess?: (result: AuthSuccess) => void | Promise<void>;
  /** Show the mode toggle between Create Account / Sign In. Default true. */
  allowModeToggle?: boolean;
  /** Show the "Continue with Google" button. Default true. */
  enableGoogle?: boolean;
  /**
   * Where GoTrue returns the browser after Google auth. Defaults to the current
   * origin. Pass an absolute URL (e.g. a /auth/callback route) once session
   * completion is wired up.
   */
  googleRedirectTo?: string;
}

export function BaroqueSignup({
  initialMode = 'signup',
  title,
  subtitle,
  onSuccess,
  allowModeToggle = true,
  enableGoogle = true,
  googleRedirectTo,
}: BaroqueSignupProps) {
  const [done, setDone] = useState<AuthMode | null>(null);
  const f = useAuthForm({
    initialMode,
    collectDisplayName: true,
    onSuccess: async (result) => {
      setDone(result.mode);
      await onSuccess?.(result);
    },
  });
  const isSignup = f.mode === 'signup';

  if (done) {
    return (
      <div className="eac-baroque-frame">
        <span className="eac-baroque-corners-bottom" />
        <p className="eac-eyebrow">
          {done === 'signup' ? 'Welcome' : 'Signed in'}
        </p>
        <h2 className="eac-title">
          {done === 'signup' ? 'You are among us.' : 'Welcome back.'}
        </h2>
        <hr className="eac-gilt-rule" />
        <div className="eac-success-card">
          <p className="eac-success-card__body">
            {done === 'signup'
              ? 'Check your email — a welcome message is on its way. Your account is live; the inner gathering awaits.'
              : 'You are signed in.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="eac-baroque-frame">
      <span className="eac-baroque-corners-bottom" />
      <h2 className="eac-title">
        {title ?? (isSignup ? 'Join the Collective' : 'Welcome Back')}
      </h2>
      <hr className="eac-gilt-rule" />
      {subtitle && <p className="eac-subtitle">{subtitle}</p>}

      {allowModeToggle && (
        <div className="eac-mode-toggle" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={isSignup}
            className={
              'eac-mode-toggle__btn' +
              (isSignup ? ' eac-mode-toggle__btn--active' : '')
            }
            onClick={() => f.setMode('signup')}
          >
            Create Account
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isSignup}
            className={
              'eac-mode-toggle__btn' +
              (!isSignup ? ' eac-mode-toggle__btn--active' : '')
            }
            onClick={() => f.setMode('signin')}
          >
            Sign In
          </button>
        </div>
      )}

      <form onSubmit={f.submit} noValidate>
        {isSignup && (
          <div className="eac-form-row">
            <label className="eac-label" htmlFor="eac-name">
              Your name
            </label>
            <input
              id="eac-name"
              className="eac-input"
              type="text"
              autoComplete="name"
              value={f.displayName}
              onChange={(e) => f.setDisplayName(e.target.value)}
            />
          </div>
        )}

        <div className="eac-form-row">
          <label className="eac-label" htmlFor="eac-email">
            Email
          </label>
          <input
            id="eac-email"
            className="eac-input"
            type="email"
            required
            autoComplete="email"
            value={f.email}
            onChange={(e) => f.setEmail(e.target.value)}
          />
        </div>

        <div className="eac-form-row">
          <label className="eac-label" htmlFor="eac-pw">
            Password
          </label>
          <input
            id="eac-pw"
            className="eac-input"
            type="password"
            required
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            value={f.password}
            onChange={(e) => f.setPassword(e.target.value)}
          />
        </div>

        {isSignup && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
          <div style={{ margin: '12px 0' }}>
            <Turnstile
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
              onSuccess={(token) => f.setTurnstileToken(token)}
              onExpire={() => f.setTurnstileToken(null)}
              onError={() => f.setTurnstileToken(null)}
              options={{ theme: 'dark' }}
            />
          </div>
        )}

        {f.error && (
          <p className="eac-error" role="alert">
            {f.error}
          </p>
        )}

        <button
          type="submit"
          className="eac-cta"
          disabled={
            f.submitting ||
            (isSignup &&
              !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY &&
              !f.turnstileToken)
          }
          style={{ width: '100%' }}
        >
          {f.submitting
            ? isSignup
              ? 'Creating account…'
              : 'Signing in…'
            : isSignup
              ? 'Join the Collective'
              : 'Sign In'}
        </button>
      </form>

      {enableGoogle && (
        <>
          <div
            aria-hidden="true"
            style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}
          >
            <span style={{ flex: 1, height: 1, background: 'rgba(201,162,77,0.4)' }} />
            <span
              style={{
                fontSize: 12,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                opacity: 0.7,
              }}
            >
              or
            </span>
            <span style={{ flex: 1, height: 1, background: 'rgba(201,162,77,0.4)' }} />
          </div>

          <button
            type="button"
            className="eac-cta"
            onClick={() => signInWithGoogle(googleRedirectTo)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              background: '#ffffff',
              color: '#3c4043',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18z"
              />
              <path
                fill="#FBBC05"
                d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z"
              />
            </svg>
            Continue with Google
          </button>
        </>
      )}
    </div>
  );
}
