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
import { useAuthForm, type AuthMode, type AuthSuccess } from '@elkdonis/auth-client';

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
}

export function BaroqueSignup({
  initialMode = 'signup',
  title,
  subtitle,
  onSuccess,
  allowModeToggle = true,
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
    </div>
  );
}
