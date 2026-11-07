"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type FormEvent } from "react";
import { mirrorLoginHref, signInWithGoogle } from "@elkdonis/auth-client";
import { TurnstileField, turnstileEnabled } from "@elkdonis/cms-ui/auth";
import { SIGNIN_EVENT, clearSeriesIntent, saveSeriesIntent, type SeriesIntent, type SigninDetail } from "./series-intent";
import "./series-top.css";

/**
 * The combined sign-in / sign-up form of the series pages (redone
 * 2026-10-10 evening; its own component since 2026-10-13 so the week page's
 * side column shows it too). Heading; Email | Password; Username (optional)
 * | Enter; OR; Google; the EAC logo.
 *
 * One form for both: sign in first; when GoTrue does not know the
 * email/password pair, create the account; when the email already has an
 * account, the password was wrong. Uses this app's `/api/auth/login`,
 * `/api/auth/signup` and Google via `/api/auth/callback`; each gives the
 * account a viewer row in the org.
 *
 * What the visitor pressed before signing in ("I'm coming" for a week, or
 * "Subscribe") travels in sessionStorage (series-intent.ts) and is done by
 * the page that comes back signed in. A signed-out "I'm coming" anywhere on
 * the page (`SIGNIN_EVENT`, from SeriesRsvp) is taken into this form.
 */

export type SeriesSignInPending = { action: "coming"; at: string } | { action: "subscribe" } | null;

export interface SeriesSignInHandle {
  /** Bring the form forward for one action: scroll to it, outline it, focus Email. */
  call: (next: Exclude<SeriesSignInPending, null>) => void;
}

/** Server messages that name the old wording are replaced: these pages never say it. */
function plain(message: string | undefined, fallback: string): string {
  if (!message || /rsvp/i.test(message)) return fallback;
  return message;
}

const GoogleMark = () => (
  <svg viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
  </svg>
);

export const SeriesSignIn = forwardRef<
  SeriesSignInHandle,
  {
    seriesId: string;
    /** Where the browser lands once signed in (through the network mirror). */
    returnTo: string;
    /** No rule above the form: it is the first thing in its column. */
    first?: boolean;
  }
>(function SeriesSignIn({ seriesId, returnTo, first = false }, ref) {
  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<SeriesSignInPending>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState<string | null>(null);
  const [needsCheck, setNeedsCheck] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);

  // No sentence is added when called (round 3, developer, 2026-10-10): the
  // heading's "Sign In/Up" is drawn in the electric blue instead.
  const call = useCallback((next: Exclude<SeriesSignInPending, null>) => {
    setPending(next);
    const form = formRef.current;
    if (form) {
      form.scrollIntoView({ block: "center", behavior: "smooth" });
      window.setTimeout(() => emailRef.current?.focus({ preventScroll: true }), 250);
    }
  }, []);
  useImperativeHandle(ref, () => ({ call }), [call]);

  // A signed-out "I'm coming" elsewhere on the page: take it into this form.
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<SigninDetail>).detail;
      if (!d || d.seriesId !== seriesId) return;
      e.preventDefault();
      call({ action: "coming", at: d.at });
    };
    window.addEventListener(SIGNIN_EVENT, on);
    return () => window.removeEventListener(SIGNIN_EVENT, on);
  }, [seriesId, call]);

  function intentOf(p: SeriesSignInPending): SeriesIntent | null {
    if (!p) return null;
    return p.action === "coming" ? { action: "coming", seriesId, at: p.at, ts: Date.now() } : { action: "subscribe", seriesId, ts: Date.now() };
  }

  async function finishSignedIn() {
    // Keep what they pressed for the page that comes back signed in. If
    // storage is unavailable, do it now: the cookies are already set.
    const intent = intentOf(pending);
    if (intent) {
      if (!saveSeriesIntent(intent)) {
        if (intent.action === "coming") {
          await fetch("/api/series/rsvp", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ seriesId, occurrenceAt: intent.at, going: true }),
          }).catch(() => null);
        } else {
          await fetch("/api/series/subscribe", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ seriesId, subscribe: true }),
          }).catch(() => null);
        }
      }
    } else {
      clearSeriesIntent();
    }
    window.location.href = mirrorLoginHref(window.location.origin, returnTo);
  }

  async function post(path: string, payload: Record<string, unknown>) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string; session?: unknown; user?: unknown };
    return { ok: res.ok, status: res.status, body };
  }

  async function onEnter(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCheckEmail(null);
    const addr = email.trim();
    if (!addr || !password) {
      setError("Enter your email and a password.");
      return;
    }
    setBusy(true);
    try {
      const login = await post("/api/auth/login", { email: addr, password });
      if (login.ok) return void (await finishSignedIn());
      const loginMsg = login.body.error ?? "";
      if (/not confirmed/i.test(loginMsg)) {
        setCheckEmail(addr);
        return;
      }
      if (login.status !== 401 || !/invalid login credentials/i.test(loginMsg)) {
        setError(plain(loginMsg, "Could not sign in. Try again."));
        return;
      }

      // Turnstile (2026-11-06): signup is refused without a token when the app
      // has TURNSTILE_SECRET_KEY. The widget appears only once sign-in has
      // failed, so members signing in never see it; the visitor completes it
      // and presses Enter again. A token is single-use, so each attempt resets it.
      if (turnstileEnabled && !turnstileToken) {
        setNeedsCheck(true);
        setError("New here? Complete the check below, then press Enter to create your account.");
        return;
      }
      const signup = await post("/api/auth/signup", {
        email: addr,
        password,
        ...(turnstileToken ? { turnstileToken } : {}),
        // The optional username is the account's display name: signup's
        // `displayName` (user metadata `display_name`), the field it
        // already takes. No new column.
        ...(username.trim() ? { displayName: username.trim() } : {}),
      });
      if (turnstileEnabled) setTurnstileReset((n) => n + 1);
      if (signup.ok) {
        // With email confirmation on, GoTrue returns a user and no session.
        if (!signup.body.session) {
          setCheckEmail(addr);
          return;
        }
        return void (await finishSignedIn());
      }
      const signupMsg = signup.body.error ?? "";
      if (/already (been )?registered|already exists/i.test(signupMsg)) {
        // No password-reset route exists on the org sites or the network yet, so no reset link is offered.
        setError("That password doesn't match the account for this email.");
        return;
      }
      setError(plain(signupMsg, "Could not create the account. Try again."));
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function onGoogle() {
    const intent = intentOf(pending);
    if (intent) saveSeriesIntent(intent);
    else clearSeriesIntent();
    void signInWithGoogle(returnTo);
  }

  return (
    <form
      ref={formRef}
      className={`ist-auth${pending ? " is-called" : ""}${first ? " is-first" : ""}`}
      onSubmit={onEnter}
      noValidate
      aria-labelledby="ist-auth-h"
    >
      {/* The EAC logo sits at the top right beside the heading at every
          width (round 3, 2026-10-10), not under Google. */}
      <div className="ist-auth__top">
        <h3 id="ist-auth-h" className="ist-auth__h">
          <span className="ist-auth__lead">Sign In/Up</span> to the Arts Collective Platform
        </h3>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ist-auth__logo" src="/eac-logo.jpg" alt="Elkdonis Arts Collective" width={350} height={392} />
      </div>
      {checkEmail ? (
        <p className="ist-auth__check" role="status">
          We sent a confirmation link to <b>{checkEmail}</b>. Open it, then come back here and press Enter again.
        </p>
      ) : null}
      <div className="ist-auth__pair">
        <div className="ist-field">
          <label htmlFor="ist-email">Email</label>
          <input
            ref={emailRef}
            id="ist-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="ist-field">
          <label htmlFor="ist-password">Password</label>
          <input
            id="ist-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
      </div>
      <div className="ist-auth__userrow">
        <div className="ist-field">
          <label htmlFor="ist-username">
            Username <span className="ist-optional">(optional)</span>
          </label>
          <input
            id="ist-username"
            type="text"
            autoComplete="nickname"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={60}
          />
        </div>
        <button type="submit" className="ifs-btn ifs-btn--primary ist-enter" disabled={busy}>
          {busy ? "…" : "Enter"}
        </button>
      </div>
      {error && <p className="ist-err" role="alert">{error}</p>}
      {needsCheck && <TurnstileField onToken={setTurnstileToken} resetSignal={turnstileReset} />}
      <div className="ist-or" role="separator" aria-label="or"><span aria-hidden="true">OR</span></div>
      <button type="button" className="ist-google" onClick={onGoogle}>
        <GoogleMark />
        Continue with Google
      </button>
    </form>
  );
});
