"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signInWithPassword, signUp } from "@elkdonis/auth-client";

const card: React.CSSProperties = {
  maxWidth: 420,
  margin: "0 auto",
  background: "#f7f1e3",
  color: "#1a1a1a",
  padding: "2rem",
  border: "1px solid #000",
  boxShadow: "0 24px 60px rgba(0,0,0,.45)",
};
const input: React.CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.65rem",
  border: "1px solid #1a1a1a",
  background: "#fff",
  fontFamily: "inherit",
  fontSize: 14,
  boxSizing: "border-box",
  marginTop: "0.35rem",
};
const label: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  letterSpacing: 1,
  textTransform: "uppercase",
  fontWeight: 700,
  marginTop: "1rem",
};

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
    <form style={card} onSubmit={onSubmit}>
      <p style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "#8c3b3b", margin: 0 }}>
        ArtDirect · an Elkdonis commons
      </p>
      <h1 style={{ fontSize: "1.6rem", margin: "0.4rem 0 0.25rem", letterSpacing: 1 }}>
        {mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}
      </h1>
      <p style={{ fontSize: 13, color: "#4a4a40", lineHeight: 1.5, marginTop: 0 }}>
        One account works across the whole Elkdonis network — directory, collective, and member sites.
      </p>

      <label style={label} htmlFor="email">Email</label>
      <input style={input} id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} required />

      <label style={label} htmlFor="password">Password</label>
      <input style={input} id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.currentTarget.value)} required minLength={6} />

      {error && <p style={{ color: "#8c3b3b", fontWeight: 700, marginTop: "0.75rem" }}>{error}</p>}

      <button
        type="submit"
        disabled={busy}
        style={{ marginTop: "1.25rem", width: "100%", background: "#1a1a1a", color: "#f7f1e3", border: "none", padding: "0.65rem", letterSpacing: 1, textTransform: "uppercase", fontFamily: "inherit", fontWeight: 700, cursor: "pointer" }}
      >
        {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
      </button>

      <p style={{ textAlign: "center", fontSize: 13, color: "#4a4a40", marginTop: "1rem" }}>
        {mode === "signin" ? "New here? " : "Already have an account? "}
        <button
          type="button"
          onClick={() => { setError(null); setMode(mode === "signin" ? "signup" : "signin"); }}
          style={{ background: "none", border: "none", color: "#8c3b3b", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}
        >
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </form>
  );
}
