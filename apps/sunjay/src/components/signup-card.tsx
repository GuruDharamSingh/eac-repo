"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import { useAuthForm, signInWithGoogle, mirrorLoginHref } from "@elkdonis/auth-client";
import { useState } from "react";

/**
 * The sign-up form on the landing page, beside the suggested materials.
 *
 * Deliberately NOT `BaroqueSignup`. That component is the network's ornamented
 * card — a gilt double frame, an occult sigil, engraved rules — and dropping
 * the whole thing onto a page about stone and qi gong imported a second visual
 * language. This is the same form in this site's voice: ruled lines, letterpress
 * labels, no ornament.
 *
 * What is NOT reimplemented is the part that matters. `useAuthForm` is the
 * shared headless hook BaroqueSignup itself uses, so validation, the POST to
 * this app's own /api/auth/{login,signup}, the Google PKCE hop and the success
 * handling are the identical code path. Only the chrome is local — if auth
 * changes, this changes with it.
 *
 * Turnstile is carried over for the same reason: the key is unset in this
 * deployment, so no widget renders and nothing is gated, but if it is ever
 * configured the server would start rejecting tokenless signups and a form
 * that had quietly dropped the widget would break with no clue why.
 */
export function SignupCard() {
  const [done, setDone] = useState<"signin" | "signup" | null>(null);

  const f = useAuthForm({
    initialMode: "signup",
    collectDisplayName: true,
    onSuccess: async (result) => {
      setDone(result.mode);
      // Run the trip through the network host once, so a later visit to
      // another site on the collective finds the session already there.
      const finalPath = result.mode === "signup" ? "/center" : "/";
      window.location.href = mirrorLoginHref(window.location.origin, finalPath);
    },
  });

  const isSignup = f.mode === "signup";
  const turnstileKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const awaitingTurnstile = isSignup && !!turnstileKey && !f.turnstileToken;

  // `border-input`, not `border-border`: --border is a DIVIDER (1.50:1 on this
  // ground, which is fine for a rule and not for a control) while --input is
  // the perceivable boundary WCAG 1.4.11 asks for on a form field — 3.51:1.
  const field =
    "mt-1 w-full border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-[hsl(var(--primary))]";
  const label =
    "text-[0.68rem] font-medium uppercase tracking-[0.16em] text-muted-foreground";

  if (done) {
    return (
      <div className="card-natural p-6">
        <h3 className="font-serif text-xl font-semibold">
          {done === "signup" ? "You're in." : "Welcome back."}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {done === "signup"
            ? "Check your email — a welcome message is on its way. Taking you to your page…"
            : "Signing you in…"}
        </p>
      </div>
    );
  }

  return (
    <div className="card-natural p-6">
      <h3 className="font-serif text-xl font-semibold">
        {isSignup ? "Join us" : "Welcome back"}
      </h3>
      <hr className="saffron-divider !my-4 max-w-[8rem]" />
      <p className="text-sm leading-relaxed text-muted-foreground">
        {isSignup
          ? "Create an account to RSVP for gatherings and follow what's on. One account works across the whole Elkdonis network."
          : "Sign in to RSVP for gatherings and pick up where you left off."}
      </p>

      {/* Two plain words with a rule under the live one — a tab strip with a
          filled pill would be the loudest thing in this column. */}
      <div className="mt-5 flex gap-5 border-b border-border" role="tablist">
        {(["signup", "signin"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={f.mode === m}
            onClick={() => f.setMode(m)}
            className={
              "-mb-px border-b-2 pb-2 text-xs font-medium uppercase tracking-[0.14em] transition-colors " +
              (f.mode === m
                ? "border-[hsl(var(--primary))] text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {m === "signup" ? "Create account" : "Sign in"}
          </button>
        ))}
      </div>

      <form onSubmit={f.submit} className="mt-5 space-y-4">
        {isSignup && (
          <div>
            <label className={label} htmlFor="sc-name">
              Your name
            </label>
            <input
              id="sc-name"
              className={field}
              value={f.displayName}
              onChange={(e) => f.setDisplayName(e.target.value)}
              autoComplete="name"
            />
          </div>
        )}

        <div>
          <label className={label} htmlFor="sc-email">
            Email
          </label>
          <input
            id="sc-email"
            className={field}
            type="email"
            required
            value={f.email}
            onChange={(e) => f.setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div>
          <label className={label} htmlFor="sc-password">
            Password
          </label>
          <input
            id="sc-password"
            className={field}
            type="password"
            required
            value={f.password}
            onChange={(e) => f.setPassword(e.target.value)}
            autoComplete={isSignup ? "new-password" : "current-password"}
          />
        </div>

        {turnstileKey && isSignup && (
          <Turnstile
            siteKey={turnstileKey}
            onSuccess={(t) => f.setTurnstileToken(t)}
            onExpire={() => f.setTurnstileToken(null)}
            onError={() => f.setTurnstileToken(null)}
          />
        )}

        {/* role="alert" so a screen reader is told, rather than the message
            merely appearing for people who can see it. */}
        {f.error && (
          <p role="alert" className="text-sm text-[hsl(var(--destructive))]">
            {f.error}
          </p>
        )}

        <button
          type="submit"
          disabled={f.submitting || awaitingTurnstile}
          // The ink on a filled accent is the GROUND, not the bone: --primary is a
          // lifted bronze on this dark site, so the ground reads 7.83:1 on it
          // while the bone would be 1.70:1. Same for the rust hover, 5.98:1.
          className="w-full bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-medium uppercase tracking-[0.12em] text-[hsl(var(--background))] transition-colors hover:bg-[hsl(var(--rust))] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {f.submitting ? "One moment…" : isSignup ? "Create account" : "Sign in"}
        </button>
      </form>

      <div className="mt-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground">
          or
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <button
        type="button"
        onClick={() => signInWithGoogle("/")}
        className="mt-4 w-full border border-input bg-background px-4 py-2.5 text-sm text-foreground transition-colors hover:border-[hsl(var(--primary))]"
      >
        Continue with Google
      </button>
    </div>
  );
}
