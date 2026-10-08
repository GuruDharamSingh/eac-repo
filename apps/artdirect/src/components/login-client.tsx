"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signInWithPassword, signUp } from "@elkdonis/auth-client";

export function LoginClient() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";
  const [mode, setMode] = useState<"signin" | "signup">(
    searchParams.get("mode") === "signup" ? "signup" : "signin"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const fn = mode === "signin" ? signInWithPassword : signUp;
    const { user, error: err } = await fn(email, password);
    if (err) {
      setBusy(false);
      setError(err);
      return;
    }
    if (!user) {
      setBusy(false);
      setError("Something went wrong. Try again.");
      return;
    }
    // Full navigation so the server re-reads the freshly-set session cookie.
    window.location.assign(redirectTo);
  }

  return (
    <form className="ad-sheet" data-size="narrow" onSubmit={onSubmit}>
      <p className="ad-sheet-eyebrow">
        ArtDirect · an Elkdonis commons
      </p>
      <h1 className="ad-sheet-title">
        {mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}
      </h1>
      <p className="ad-sheet-lede">
        One account works across the whole Elkdonis network — directory, collective, and member sites.
      </p>

      <label className="ad-label" htmlFor="email">Email</label>
      <input className="ad-field" id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} required />

      <label className="ad-label" htmlFor="password">Password</label>
      <input className="ad-field" id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.currentTarget.value)} required minLength={6} />

      {error && <p className="ad-sheet-error" role="alert">{error}</p>}

      <button type="submit" disabled={busy} className="ad-button" data-variant="ink" data-block="">
        {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
      </button>

      <p className="ad-sheet-switch">
        {mode === "signin" ? "New here? " : "Already have an account? "}
        <button
          type="button"
          onClick={() => { setError(null); setMode(mode === "signin" ? "signup" : "signin"); }}
          className="ad-link-button"
        >
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </form>
  );
}
