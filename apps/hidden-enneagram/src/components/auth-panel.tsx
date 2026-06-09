"use client";

import { useRouter } from "next/navigation";
import { Turnstile } from "@marsidev/react-turnstile";
import { useAuthForm, type AuthMode } from "@elkdonis/auth-client";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Dark, serif sign-in / sign-up panel for hiddenenneagram.com. Uses the shared
 * headless useAuthForm; the signup API route scopes new members to the
 * 'hidden-enneagram' org. Styled inline to match the dark template.
 */

const field: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: "var(--eac-enn-bg-soft, rgba(255,255,255,0.04))",
  border: "1px solid rgba(236,231,221,0.18)",
  borderRadius: "8px",
  color: "#ece7dd",
  fontFamily: "var(--font-eb-garamond), Georgia, serif",
  fontSize: "16px",
};

const label: React.CSSProperties = {
  display: "block",
  marginBottom: "8px",
  fontSize: "13px",
  letterSpacing: "0.04em",
  color: "#bcb6aa",
};

export function AuthPanel({ initialMode }: { initialMode: AuthMode }) {
  const router = useRouter();
  const f = useAuthForm({
    initialMode,
    collectDisplayName: true,
    onSuccess: () => {
      router.push("/account");
      router.refresh();
    },
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "#0a0a0c",
        color: "#ece7dd",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <h1
          style={{
            margin: "0 0 8px",
            fontFamily: "var(--font-cormorant), Georgia, serif",
            fontWeight: 500,
            fontSize: 40,
            lineHeight: 1.05,
            textAlign: "center",
          }}
        >
          {f.mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p
          style={{
            margin: "0 0 32px",
            textAlign: "center",
            color: "#8a857b",
            fontFamily: "var(--font-eb-garamond), Georgia, serif",
            fontSize: 16,
          }}
        >
          The Hidden Enneagram
        </p>

        <form onSubmit={f.submit} style={{ display: "grid", gap: 18 }}>
          {f.mode === "signup" && (
            <div>
              <label style={label} htmlFor="ae-name">
                Name
              </label>
              <input
                id="ae-name"
                style={field}
                type="text"
                autoComplete="name"
                value={f.displayName}
                onChange={(e) => f.setDisplayName(e.target.value)}
              />
            </div>
          )}

          <div>
            <label style={label} htmlFor="ae-email">
              Email
            </label>
            <input
              id="ae-email"
              style={field}
              type="email"
              autoComplete="email"
              value={f.email}
              onChange={(e) => f.setEmail(e.target.value)}
            />
          </div>

          <div>
            <label style={label} htmlFor="ae-password">
              Password
            </label>
            <input
              id="ae-password"
              style={field}
              type="password"
              autoComplete={f.mode === "signin" ? "current-password" : "new-password"}
              value={f.password}
              onChange={(e) => f.setPassword(e.target.value)}
            />
          </div>

          {f.mode === "signup" && TURNSTILE_SITE_KEY && (
            <Turnstile
              siteKey={TURNSTILE_SITE_KEY}
              onSuccess={(token) => f.setTurnstileToken(token)}
              onExpire={() => f.setTurnstileToken(null)}
              onError={() => f.setTurnstileToken(null)}
              options={{ theme: "dark" }}
            />
          )}

          {f.error && (
            <p role="alert" style={{ margin: 0, color: "#e07a7a", fontSize: 15 }}>
              {f.error}
            </p>
          )}

          <button
            type="submit"
            disabled={
              f.submitting ||
              (f.mode === "signup" && !!TURNSTILE_SITE_KEY && !f.turnstileToken)
            }
            style={{
              padding: "13px 0",
              border: "1px solid rgba(236,231,221,0.18)",
              borderRadius: 999,
              background: "#3aa99c",
              color: "#04130f",
              fontFamily: "var(--font-eb-garamond), Georgia, serif",
              fontSize: 13,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              cursor: f.submitting ? "default" : "pointer",
              opacity: f.submitting ? 0.6 : 1,
            }}
          >
            {f.submitting
              ? "Working…"
              : f.mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>

          <p style={{ textAlign: "center", color: "#8a857b", fontSize: 14 }}>
            {f.mode === "signin" ? "New here? " : "Already have an account? "}
            <button
              type="button"
              onClick={f.toggleMode}
              style={{
                background: "none",
                border: "none",
                color: "#3aa99c",
                cursor: "pointer",
                fontSize: 14,
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              {f.mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </form>
      </div>
    </main>
  );
}
