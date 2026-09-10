"use client";

/**
 * BaroqueSignup — bright occult-baroque sign-up / sign-in card.
 *
 * A restyled, re-homed version of the component that lived in
 * @elkdonis/ui. The original was already Mantine-free, but importing it
 * through the ui barrel pulls Mantine into apps that deliberately avoid it
 * (ifac, arts-collective, amrit-canada, pigeonshoot all use only this one
 * component from that package). Living here, it costs those apps nothing.
 *
 * Every connection is preserved exactly:
 *   - useAuthForm({ initialMode, collectDisplayName: true, onSuccess })
 *   - signInWithGoogle(googleRedirectTo)
 *   - Turnstile, gated on NEXT_PUBLIC_TURNSTILE_SITE_KEY, wired to
 *     setTurnstileToken on success / expire / error
 *   - submit disabled while submitting, and on signup until Turnstile has
 *     returned a token (when Turnstile is configured at all)
 *   - the post-submit success panel, per mode
 *
 * Two deliberate changes from the original beyond styling:
 *   - It carries its own stylesheet, so an app no longer needs
 *     @elkdonis/ui/eac-theme.css just to render a login form.
 *   - The display face is a var (--eac-bq-display) over a serif stack rather
 *     than a hard requirement for /fonts/RELIGATH-Demo.otf, which every
 *     consuming app had to serve from its own public folder. Apps that ship
 *     that font can still point the var at it.
 */

import { useState, type ReactNode } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import {
  useAuthForm,
  signInWithGoogle,
  type AuthMode,
  type AuthSuccess,
} from "@elkdonis/auth-client";

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
  /** Where GoTrue returns the browser after Google auth. Defaults to origin. */
  googleRedirectTo?: string;
}

/** Ornamental sigil — decorative only, hidden from assistive tech. */
function Sigil() {
  return (
    <svg className="eac-bq-sigil" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="27" />
      <circle cx="32" cy="32" r="20" />
      <path d="M32 7 L53.7 44.5 H10.3 Z" />
      <path d="M32 57 L10.3 19.5 H53.7 Z" />
      <circle cx="32" cy="32" r="5.5" className="eac-bq-sigil-core" />
    </svg>
  );
}

export function BaroqueSignup({
  initialMode = "signup",
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
  const isSignup = f.mode === "signup";

  // Turnstile is optional: unset key means no widget and no gate on submit.
  const turnstileKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const awaitingTurnstile = isSignup && !!turnstileKey && !f.turnstileToken;

  if (done) {
    return (
      <div className="eac-bq">
        <div className="eac-bq-frame">
          <Sigil />
          <p className="eac-bq-eyebrow">{done === "signup" ? "Welcome" : "Signed in"}</p>
          <h2 className="eac-bq-title">
            {done === "signup" ? "You are among us." : "Welcome back."}
          </h2>
          <hr className="eac-bq-rule" />
          <p className="eac-bq-success">
            {done === "signup"
              ? "Check your email — a welcome message is on its way. Your account is live; the inner gathering awaits."
              : "You are signed in."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="eac-bq">
      <div className="eac-bq-frame">
        <Sigil />
        <h2 className="eac-bq-title">
          {title ?? (isSignup ? "Join the Collective" : "Welcome Back")}
        </h2>
        <hr className="eac-bq-rule" />
        {subtitle && <p className="eac-bq-subtitle">{subtitle}</p>}

        {allowModeToggle && (
          <div className="eac-bq-toggle" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={isSignup}
              className={`eac-bq-toggle-btn${isSignup ? " is-active" : ""}`}
              onClick={() => f.setMode("signup")}
            >
              Create Account
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!isSignup}
              className={`eac-bq-toggle-btn${!isSignup ? " is-active" : ""}`}
              onClick={() => f.setMode("signin")}
            >
              Sign In
            </button>
          </div>
        )}

        <form onSubmit={f.submit} noValidate>
          {isSignup && (
            <div className="eac-bq-row">
              <label className="eac-bq-label" htmlFor="eac-bq-name">
                Your name
              </label>
              <input
                id="eac-bq-name"
                className="eac-bq-input"
                type="text"
                autoComplete="name"
                value={f.displayName}
                onChange={(e) => f.setDisplayName(e.target.value)}
              />
            </div>
          )}

          <div className="eac-bq-row">
            <label className="eac-bq-label" htmlFor="eac-bq-email">
              Email
            </label>
            <input
              id="eac-bq-email"
              className="eac-bq-input"
              type="email"
              required
              autoComplete="email"
              value={f.email}
              onChange={(e) => f.setEmail(e.target.value)}
            />
          </div>

          <div className="eac-bq-row">
            <label className="eac-bq-label" htmlFor="eac-bq-pw">
              Password
            </label>
            <input
              id="eac-bq-pw"
              className="eac-bq-input"
              type="password"
              required
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={f.password}
              onChange={(e) => f.setPassword(e.target.value)}
            />
          </div>

          {isSignup && turnstileKey && (
            <div className="eac-bq-turnstile">
              <Turnstile
                siteKey={turnstileKey}
                onSuccess={(token) => f.setTurnstileToken(token)}
                onExpire={() => f.setTurnstileToken(null)}
                onError={() => f.setTurnstileToken(null)}
                options={{ theme: "light" }}
              />
            </div>
          )}

          {f.error && (
            <p className="eac-bq-error" role="alert">
              {f.error}
            </p>
          )}

          <button
            type="submit"
            className="eac-bq-cta"
            disabled={f.submitting || awaitingTurnstile}
          >
            {f.submitting
              ? isSignup
                ? "Creating account…"
                : "Signing in…"
              : isSignup
                ? "Join the Collective"
                : "Sign In"}
          </button>
        </form>

        {enableGoogle && (
          <>
            <p className="eac-bq-or">
              <span>or</span>
            </p>
            <button
              type="button"
              className="eac-bq-cta eac-bq-cta--google"
              onClick={() => signInWithGoogle(googleRedirectTo)}
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
    </div>
  );
}
