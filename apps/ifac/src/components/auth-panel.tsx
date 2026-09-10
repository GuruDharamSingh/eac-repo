"use client";

import { useState } from "react";
import { useAuthForm, signInWithGoogle } from "@elkdonis/auth-client";

/**
 * Create an account or sign in, on the home page.
 *
 * Replaces the mailing-list form that used to sit here (name / interest /
 * region / message → the `contacts` table via /api/signup). That form
 * collected an address and did nothing else; an account is what actually
 * lets someone claim their artist or dealer profile and reach the hub.
 *
 * Uses the same `useAuthForm` hook as the /login page, so both go through
 * /api/auth/signup and /api/auth/login and behave identically — but rendered
 * with the home page's own panel styling (.form-shell, .field, .button)
 * rather than the baroque card, which belongs to the dedicated login screen.
 *
 * A login here is a NETWORK login: one GoTrue instance keyed on email serves
 * every Elkdonis site, and signing in grants no role on IFAC by itself —
 * that comes from user_organizations.
 */
export function AuthPanel({ signedInEmail }: { signedInEmail?: string | null }) {
  const [done, setDone] = useState<"signup" | "signin" | null>(null);

  const f = useAuthForm({
    initialMode: "signup",
    collectDisplayName: true,
    onSuccess: async (result) => {
      setDone(result.mode);
      // Signing in mid-page should land somewhere useful rather than leaving
      // the person staring at the form they just completed.
      if (result.mode === "signin") window.location.href = "/hub";
    },
  });

  const isSignup = f.mode === "signup";

  if (signedInEmail) {
    return (
      <div className="form-shell auth-panel">
        <p className="auth-panel-note">
          Signed in as <strong>{signedInEmail}</strong>.
        </p>
        <a className="button" href="/hub">
          Go to your hub
        </a>
      </div>
    );
  }

  if (done === "signup") {
    return (
      <div className="form-shell auth-panel">
        <p className="auth-panel-note">
          Check your email to confirm the address. Once confirmed you can claim
          your artist or dealer profile from the hub.
        </p>
        <a className="button" href="/hub">
          Go to your hub
        </a>
      </div>
    );
  }

  return (
    <div className="form-shell auth-panel">
      <div className="auth-panel-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={isSignup}
          className={`auth-panel-tab${isSignup ? " is-active" : ""}`}
          onClick={() => f.setMode("signup")}
        >
          Create account
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!isSignup}
          className={`auth-panel-tab${!isSignup ? " is-active" : ""}`}
          onClick={() => f.setMode("signin")}
        >
          Sign in
        </button>
      </div>

      <form onSubmit={f.submit} noValidate>
        <div className="field-grid">
          {isSignup && (
            <div className="field">
              <label htmlFor="auth-name">Name</label>
              <input
                id="auth-name"
                type="text"
                autoComplete="name"
                placeholder="Collector, artist or dealer name"
                value={f.displayName}
                onChange={(e) => f.setDisplayName(e.target.value)}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={f.email}
              onChange={(e) => f.setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              required
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder={isSignup ? "At least 6 characters" : "Your password"}
              value={f.password}
              onChange={(e) => f.setPassword(e.target.value)}
            />
          </div>
        </div>

        <div className="auth-panel-actions">
          <button className="button" type="submit" disabled={f.submitting}>
            {f.submitting
              ? isSignup
                ? "Creating account"
                : "Signing in"
              : isSignup
                ? "Create account"
                : "Sign in"}
          </button>
          <button
            className="button button--ghost"
            type="button"
            onClick={() => signInWithGoogle("/hub")}
          >
            Continue with Google
          </button>
        </div>

        <div className="form-status" aria-live="polite">
          {f.error}
        </div>
      </form>
    </div>
  );
}
